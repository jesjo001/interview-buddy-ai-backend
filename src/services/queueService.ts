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
import { TopicDifficulty } from '../types';

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

        const newTopic = await Topic.create({
          interviewPrepId: prepId,
          title: topicTitle,
          category: skillTopics.includes(topicTitle) ? 'Technical Skills' : 'Behavioral',
          difficulty: TopicDifficulty.INTERMEDIATE,
          content,
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

const processJob = async (job: QueueJob) => {
  job.status = 'processing';
  console.log(`[QueueService] Processing job ${job.id} of type ${job.type}...`);

  try {
    const prep = await InterviewPrep.findById(job.data.prepId);
    if (!prep) {
      throw new Error(`InterviewPrep with ID ${job.data.prepId} not found.`);
    }
    const user = await User.findById(job.data.userId);
    if (!user) {
      throw new Error(`User with ID ${job.data.userId} not found.`);
    }

    let parsedJobData: JobParsedData;

    switch (job.type) {
      case 'analyze-job-description':
        const analyzeData = job.data as AnalyzeJobDescriptionJobData;
        parsedJobData = await analyzeJobDescription(analyzeData.jobDescription.rawText);

        prep.jobDescription.parsedData = parsedJobData;
        await prep.save();

        const studyPlanResult = await generateStudyPlanAndContent(
          prep._id,
          user._id,
          parsedJobData,
          analyzeData.interviewDate,
          analyzeData.dailyStudyTime,
          analyzeData.learningStyle
        );
        prep.studyPlan = studyPlanResult;
        prep.status = TopicDifficulty.INTERMEDIATE; // Assuming active after generation, adjust as needed

        // Update overall progress based on generated topics
        const totalTopicsCount = prep.studyPlan.dailySchedule.flatMap(day => day.topics).length;
        prep.progress.totalTopics = totalTopicsCount;
        prep.progress.overallPercentage = totalTopicsCount > 0 ? 0 : 100; // 0% at start

        await prep.save();

        await sendEmail({
          to: user.email,
          subject: 'Your Interview Prep is Ready!',
          html: `<p>Your interview preparation for <b>${parsedJobData.jobTitle}</b> at <b>${parsedJobData.company}</b> is ready! Log in to start studying.</p>`
        });
        break;

      case 'adjust-study-plan':
        const adjustData = job.data as AdjustStudyPlanJobData;
        parsedJobData = adjustData.jobDescription; // Use already parsed data

        // Clear existing topics and flashcards for this prep before regenerating
        await Topic.deleteMany({ interviewPrepId: prep._id });
        await Flashcard.deleteMany({ userId: user._id, topicId: { $in: prep.studyPlan.dailySchedule.flatMap(day => day.topics.map(t => t.topicId)) } });


        const adjustedStudyPlanResult = await generateStudyPlanAndContent(
          prep._id,
          user._id,
          parsedJobData,
          adjustData.interviewDate,
          adjustData.dailyStudyTime,
          adjustData.learningStyle
        );
        prep.studyPlan = adjustedStudyPlanResult;
        
        // Update overall progress based on regenerated topics
        const newTotalTopicsCount = prep.studyPlan.dailySchedule.flatMap(day => day.topics).length;
        prep.progress.totalTopics = newTotalTopicsCount;
        prep.progress.topicsCompleted = 0;
        prep.progress.overallPercentage = newTotalTopicsCount > 0 ? 0 : 100; // Reset progress
        
        await prep.save();

        await sendEmail({
          to: user.email,
          subject: 'Your Interview Prep Study Plan has been adjusted!',
          html: `<p>Your study plan for <b>${prep.jobDescription.parsedData?.jobTitle}</b> has been updated based on your new interview date. Log in to see the changes.</p>`
        });
        break;

      default:
        console.warn(`[QueueService] Unknown job type: ${job.type}`);
        throw new Error('Unknown job type');
    }

    job.status = 'completed';
    console.log(`[QueueService] Job ${job.id} completed.`);
    jobProcessor.emit('job:completed', job);
  } catch (error: any) {
    job.status = 'failed';
    job.retries++;
    console.error(`[QueueService] Job ${job.id} failed: ${error.message}. Retries: ${job.retries}/${job.maxRetries}`);
    if (job.retries < job.maxRetries) {
      // Re-add to queue for retry (e.g., with a delay)
      // For simplicity, directly re-adding. In production, might use a delayed queue or separate retry logic.
      jobQueue.unshift(job);
      jobProcessor.emit('job:retrying', job);
    } else {
      console.error(`[QueueService] Job ${job.id} permanently failed after ${job.maxRetries} retries.`);
      jobProcessor.emit('job:failed', job);
      // Send error notification to user/admin
      try {
        const user = await User.findById(job.data.userId);
        if (user) {
          await sendEmail({
            to: user.email,
            subject: `Action Required: Interview Prep Processing Failed`,
            html: `<p>Dear ${user.name},</p><p>We encountered an issue while processing your interview prep for ${job.data.prepId}. Please try again or contact support if the issue persists.</p><p>Error: ${error.message}</p>`
          });
        }
      } catch (emailError) {
        console.error('Failed to send error email:', emailError);
      }
    }
  }
};

const consumer = async () => {
  if (isProcessing || jobQueue.length === 0) {
    return;
  }

  isProcessing = true;
  const job = jobQueue.shift(); // Get the next job from the queue

  if (job) {
    await processJob(job);
  }
  isProcessing = false;
};

// Start the consumer at regular intervals
let consumerInterval: NodeJS.Timeout;

export const jobQueueService = {
  add: (type: string, data: AnalyzeJobDescriptionJobData | AdjustStudyPlanJobData, maxRetries: number = 3) => {
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
