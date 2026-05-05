// services/queueService.ts
import EventEmitter from 'events';
import { Types } from 'mongoose';
import InterviewPrep, { IDailyScheduleTopic } from '../models/InterviewPrep';
import User from '../models/User';
import Topic from '../models/Topic';
import Flashcard from '../models/Flashcard';
import { analyzeJobDescription, generateFlashcards, generateStudyPlanTopics, generateTopicContent, JobParsedData } from './aiService';
import { calculateDaysBetween, getFutureDate } from '../utils/helpers';
import { sendEmail } from './emailService';
import { AnalysisStatus, TopicDifficulty, PrepStatus } from '../types';
import dotenv from 'dotenv';

dotenv.config();

// Redis / Bull optional integration
const redisUrl = process.env.REDIS_URL || process.env.BULL_REDIS_URL || 'redis://127.0.0.1:6379';
const enableBullEnv = (process.env.ENABLE_BULL || '').toLowerCase();
const useBull = enableBullEnv === 'true' || (!!process.env.REDIS_URL && enableBullEnv !== 'false');

let bullAvailable = false;
let BullQueue: any = null;
let BullWorker: any = null;
let bullQueue: any = null;

if (useBull) {
  try {
    // Dynamic import so package is optional
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bullmq = require('bullmq');
    BullQueue = bullmq.Queue;
    BullWorker = bullmq.Worker;
    bullAvailable = true;
    bullQueue = new BullQueue('prep-jobs', { connection: { url: redisUrl } });
    console.log('[QueueService] BullMQ detected and connected to Redis at', redisUrl);
  } catch (err) {
    console.warn('[QueueService] BullMQ not available or failed to connect. Falling back to in-memory queue.');
    bullAvailable = false;
  }
} else {
  console.log('[QueueService] BullMQ disabled by configuration. Using in-memory queue.');
}

interface JobDataBase {
  prepId: Types.ObjectId;
  userId: Types.ObjectId;
}

interface AnalyzeJobDescriptionJobData extends JobDataBase {
  jobDescription: { rawText: string; fileUrl?: string };
  interviewDate: Date;
  dailyStudyTime: number;
  learningStyle: string;
}

interface AdjustStudyPlanJobData extends JobDataBase {
  jobDescription: JobParsedData;
  interviewDate: Date;
  dailyStudyTime: number;
  learningStyle: string;
}

interface QueueJob {
  id: string;
  type: string;
  data: AnalyzeJobDescriptionJobData | AdjustStudyPlanJobData;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  maxRetries: number;
}

const jobQueue: QueueJob[] = [];
const jobProcessor = new EventEmitter();
let isProcessing = false;

const JOB_PROCESSING_INTERVAL = 5000; // Process jobs every 5 seconds

// Helper function to encapsulate study plan generation and content creation
const generateStudyPlanAndContent = async (
  prepId: Types.ObjectId,
  userId: Types.ObjectId,
  parsedData: JobParsedData,
  interviewDate: Date,
  dailyStudyTime: number,
  learningStyle: string
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  const totalDays = calculateDaysBetween(today, interviewDate);

  if (totalDays <= 0) {
    throw new Error('Interview date must be in the future.');
  }

  // Get topics from AI (or pre-defined)
  const skillTopics = await generateStudyPlanTopics(parsedData, TopicDifficulty.INTERMEDIATE);
  const behavioralTopics = ['Tell me about yourself', 'Why this role/company?', 'Strength/Weakness', 'Conflict resolution'];

  const allTopicsToCover = [...new Set([...skillTopics, ...behavioralTopics])]; // Unique topics

  const dailySchedule: { day: number; date: Date; topics: IDailyScheduleTopic[] }[] = [];
  let topicIndex = 0;
  let currentDay = 0;

  while (topicIndex < allTopicsToCover.length && currentDay < totalDays) {
    const dayDate = getFutureDate(today, currentDay);
    const dayTopics: IDailyScheduleTopic[] = [];
    let estimatedTimeForDay = 0;

    while (estimatedTimeForDay < dailyStudyTime && topicIndex < allTopicsToCover.length) {
      const topicTitle = allTopicsToCover[topicIndex];
      const estimatedTopicTime = 30; // Assume 30 min per topic for now

      if (estimatedTimeForDay + estimatedTopicTime <= dailyStudyTime) {
        const aiTopicContent = await generateTopicContent(topicTitle, TopicDifficulty.INTERMEDIATE);

        const { mindMap, ...content } = aiTopicContent;

        const newTopic = await (Topic as any).create({
          interviewPrepId: prepId,
          title: topicTitle,
          category: skillTopics.includes(topicTitle) ? 'Technical Skills' : 'Behavioral',
          difficulty: TopicDifficulty.INTERMEDIATE,
          content: content as any,
          mindMap,
          masteryLevel: 0,
        });

        const aiFlashcards = await generateFlashcards(aiTopicContent.deepDive || aiTopicContent.summary, 5);
        await Flashcard.insertMany(aiFlashcards.map(card => ({
          topicId: newTopic._id,
          userId: userId,
          front: card.front,
          back: card.back,
          difficulty: 'medium',
          reviewSchedule: {
            nextReview: today,
            interval: 1,
            repetitions: 0,
            easeFactor: 2.5,
          },
          reviewHistory: [],
        })));

        dayTopics.push({
          topicId: newTopic._id,
          estimatedTime: estimatedTopicTime,
          completed: false,
        });
        estimatedTimeForDay += estimatedTopicTime;
        topicIndex++;
      } else {
        break;
      }
    }

    dailySchedule.push({
      day: currentDay + 1,
      date: dayDate,
      topics: dayTopics,
    });
    currentDay++;
  }

  return {
    startDate: today,
    totalDays: totalDays,
    dailySchedule: dailySchedule,
  };
};
// Expose a generic handler for both in-memory and Bull workers to call
export const handleJob = async (type: string, data: any) => {
  console.log(`[QueueService] Handling job of type ${type}...`);

  // Mark as processing early so we can detect crash-stuck jobs on restart
  let prep = await InterviewPrep.findById(data.prepId);
  if (!prep) {
    console.warn(`[QueueService] InterviewPrep ${data.prepId} not found – skipping job.`);
    return;
  }
  prep.analysisStatus = AnalysisStatus.PROCESSING;
  await prep.save();

  try {
    // Re-fetch after marking (avoids stale reference race)
    prep = (await InterviewPrep.findById(data.prepId))!;
    const user = await User.findById(data.userId);
    if (!user) {
      throw new Error(`User with ID ${data.userId} not found.`);
    }

    let parsedJobData: JobParsedData;

    switch (type) {
      case 'analyze-job-description': {
        parsedJobData = await analyzeJobDescription(data.jobDescription.rawText);

        prep.jobDescription.parsedData = parsedJobData;
        await prep.save();

        const studyPlanResult = await generateStudyPlanAndContent(
          prep._id,
          user._id,
          parsedJobData,
          new Date(data.interviewDate),
          data.dailyStudyTime,
          data.learningStyle
        );
        prep.studyPlan = studyPlanResult;
        prep.status = PrepStatus.ACTIVE;
        prep.analysisStatus = AnalysisStatus.COMPLETED;

        const totalTopicsCount = prep.studyPlan.dailySchedule.flatMap((day) => day.topics).length;
        prep.progress.totalTopics = totalTopicsCount;
        prep.progress.overallPercentage = totalTopicsCount > 0 ? 0 : 100;

        await prep.save();

        await sendEmail({
          to: user.email,
          subject: 'Your Interview Prep is Ready!',
          html: `<p>Your interview preparation for <b>${parsedJobData.jobTitle}</b> at <b>${parsedJobData.company}</b> is ready! Log in to start studying.</p>`,
        });
        break;
      }

      case 'adjust-study-plan': {
        parsedJobData = data.jobDescription; // already parsed

        await Topic.deleteMany({ interviewPrepId: prep._id });
        await Flashcard.deleteMany({ userId: user._id, topicId: { $in: prep.studyPlan.dailySchedule.flatMap((day) => day.topics.map((t) => t.topicId)) } });

        const adjustedStudyPlanResult = await generateStudyPlanAndContent(
          prep._id,
          user._id,
          parsedJobData,
          new Date(data.interviewDate),
          data.dailyStudyTime,
          data.learningStyle
        );
        prep.studyPlan = adjustedStudyPlanResult;

        const newTotalTopicsCount = prep.studyPlan.dailySchedule.flatMap((day) => day.topics).length;
        prep.progress.totalTopics = newTotalTopicsCount;
        prep.progress.topicsCompleted = 0;
        prep.progress.overallPercentage = newTotalTopicsCount > 0 ? 0 : 100;
        prep.analysisStatus = AnalysisStatus.COMPLETED;

        await prep.save();

        await sendEmail({
          to: user.email,
          subject: 'Your Interview Prep Study Plan has been adjusted!',
          html: `<p>Your study plan for <b>${prep.jobDescription.parsedData?.jobTitle}</b> has been updated based on your new interview date. Log in to see the changes.</p>`,
        });
        break;
      }

      default:
        console.warn(`[QueueService] Unknown job type: ${type}`);
        throw new Error('Unknown job type');
    }

    console.log(`[QueueService] Job of type ${type} processed successfully.`);
  } catch (error: any) {
    console.error(`[QueueService] Error handling job of type ${type}:`, error?.message || error);
    // Mark as failed in DB so the recovery scan won't loop it indefinitely
    try {
      const failedPrep = await InterviewPrep.findById(data.prepId);
      if (failedPrep && failedPrep.analysisStatus !== AnalysisStatus.COMPLETED) {
        failedPrep.analysisStatus = AnalysisStatus.FAILED;
        await failedPrep.save();
      }
    } catch (saveErr: any) {
      console.error('[QueueService] Could not persist FAILED status:', saveErr?.message);
    }
    // Note: when using Bull, retries/attempts will be handled by Bull configuration
    throw error;
  }
};

const consumer = async () => {
  if (isProcessing || jobQueue.length === 0) {
    return;
  }

  isProcessing = true;
  const job = jobQueue.shift(); // Get the next job from the queue

  if (job) {
    try {
      await handleJob(job.type, job.data);
      job.status = 'completed';
      jobProcessor.emit('job:completed', job);
    } catch (err) {
      job.status = 'failed';
      job.retries++;
      if (job.retries < job.maxRetries) {
        jobQueue.unshift(job);
        jobProcessor.emit('job:retrying', job);
      } else {
        jobProcessor.emit('job:failed', job);
      }
    }
  }
  isProcessing = false;
};

// Start the consumer at regular intervals
let consumerInterval: NodeJS.Timeout | undefined;

export const jobQueueService = {
  add: (type: string, data: AnalyzeJobDescriptionJobData | AdjustStudyPlanJobData, maxRetries: number = 3) => {
    if (useBull && bullAvailable && bullQueue) {
      // Add job to Bull queue with attempts for retries
      bullQueue.add(type, data, { attempts: maxRetries, backoff: { type: 'exponential', delay: 2000 } });
      console.log(`[QueueService] Added job to Bull queue of type ${type}`);
      return;
    }

    const newJob: QueueJob = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: new Date(),
      status: 'pending',
      retries: 0,
      maxRetries,
    };
    jobQueue.push(newJob);
    console.log(`[QueueService] Added job ${newJob.id} of type ${type}`);
    jobProcessor.emit('job:added', newJob);
  },

  start: () => {
    if (useBull && bullAvailable && BullWorker) {
      // Start a separate worker process instead. If running in the same process we still create a Worker instance.
      try {
        const worker = new BullWorker(
          'prep-jobs',
          async (job: any) => {
            console.log('[QueueService] Bull worker processing job', job.name);
            await handleJob(job.name, job.data);
          },
          { connection: { url: redisUrl } }
        );
        console.log('[QueueService] Bull worker started in-process.');
        return;
      } catch (err) {
        console.warn('[QueueService] Failed to start in-process Bull worker, falling back to in-memory consumer.', err);
      }
    }

    if (!consumerInterval) {
      console.log('[QueueService] Starting job queue consumer...');
      consumerInterval = setInterval(consumer, JOB_PROCESSING_INTERVAL);
    }
  },

  stop: () => {
    if (consumerInterval) {
      console.log('[QueueService] Stopping job queue consumer...');
      clearInterval(consumerInterval);
      consumerInterval = undefined;
    }
  },

  on: jobProcessor.on.bind(jobProcessor),
  off: jobProcessor.off.bind(jobProcessor),
};
