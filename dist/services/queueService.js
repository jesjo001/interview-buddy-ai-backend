"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobQueueService = exports.handleJob = void 0;
// services/queueService.ts
const events_1 = __importDefault(require("events"));
const InterviewPrep_1 = __importDefault(require("../models/InterviewPrep"));
const User_1 = __importDefault(require("../models/User"));
const Topic_1 = __importDefault(require("../models/Topic"));
const Flashcard_1 = __importDefault(require("../models/Flashcard"));
const aiService_1 = require("./aiService");
const helpers_1 = require("../utils/helpers");
const emailService_1 = require("./emailService");
const types_1 = require("../types");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Redis / Bull optional integration
const redisUrl = process.env.REDIS_URL || process.env.BULL_REDIS_URL || 'redis://127.0.0.1:6379';
const enableBullEnv = (process.env.ENABLE_BULL || '').toLowerCase();
const useBull = enableBullEnv === 'true' || (!!process.env.REDIS_URL && enableBullEnv !== 'false');
let bullAvailable = false;
let BullQueue = null;
let BullWorker = null;
let bullQueue = null;
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
    }
    catch (err) {
        console.warn('[QueueService] BullMQ not available or failed to connect. Falling back to in-memory queue.');
        bullAvailable = false;
    }
}
else {
    console.log('[QueueService] BullMQ disabled by configuration. Using in-memory queue.');
}
const jobQueue = [];
const jobProcessor = new events_1.default();
let isProcessing = false;
const JOB_PROCESSING_INTERVAL = 5000; // Process jobs every 5 seconds
// Helper function to encapsulate study plan generation and content creation
const generateStudyPlanAndContent = async (prepId, userId, parsedData, interviewDate, dailyStudyTime, learningStyle) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    const totalDays = (0, helpers_1.calculateDaysBetween)(today, interviewDate);
    if (totalDays <= 0) {
        throw new Error('Interview date must be in the future.');
    }
    // Get topics from AI (or pre-defined)
    const skillTopics = await (0, aiService_1.generateStudyPlanTopics)(parsedData, types_1.TopicDifficulty.INTERMEDIATE);
    const behavioralTopics = ['Tell me about yourself', 'Why this role/company?', 'Strength/Weakness', 'Conflict resolution'];
    const allTopicsToCover = [...new Set([...skillTopics, ...behavioralTopics])]; // Unique topics
    const dailySchedule = [];
    let topicIndex = 0;
    let currentDay = 0;
    while (topicIndex < allTopicsToCover.length && currentDay < totalDays) {
        const dayDate = (0, helpers_1.getFutureDate)(today, currentDay);
        const dayTopics = [];
        let estimatedTimeForDay = 0;
        while (estimatedTimeForDay < dailyStudyTime && topicIndex < allTopicsToCover.length) {
            const topicTitle = allTopicsToCover[topicIndex];
            const estimatedTopicTime = 30; // Assume 30 min per topic for now
            if (estimatedTimeForDay + estimatedTopicTime <= dailyStudyTime) {
                const aiTopicContent = await (0, aiService_1.generateTopicContent)(topicTitle, types_1.TopicDifficulty.INTERMEDIATE);
                const { mindMap, ...content } = aiTopicContent;
                const newTopic = await Topic_1.default.create({
                    interviewPrepId: prepId,
                    title: topicTitle,
                    category: skillTopics.includes(topicTitle) ? 'Technical Skills' : 'Behavioral',
                    difficulty: types_1.TopicDifficulty.INTERMEDIATE,
                    content: content,
                    mindMap,
                    masteryLevel: 0,
                });
                const aiFlashcards = await (0, aiService_1.generateFlashcards)(aiTopicContent.deepDive || aiTopicContent.summary, 5);
                await Flashcard_1.default.insertMany(aiFlashcards.map(card => ({
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
            }
            else {
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
const handleJob = async (type, data) => {
    console.log(`[QueueService] Handling job of type ${type}...`);
    // Mark as processing early so we can detect crash-stuck jobs on restart
    let prep = await InterviewPrep_1.default.findById(data.prepId);
    if (!prep) {
        console.warn(`[QueueService] InterviewPrep ${data.prepId} not found – skipping job.`);
        return;
    }
    prep.analysisStatus = types_1.AnalysisStatus.PROCESSING;
    await prep.save();
    try {
        // Re-fetch after marking (avoids stale reference race)
        prep = (await InterviewPrep_1.default.findById(data.prepId));
        const user = await User_1.default.findById(data.userId);
        if (!user) {
            throw new Error(`User with ID ${data.userId} not found.`);
        }
        let parsedJobData;
        switch (type) {
            case 'analyze-job-description': {
                parsedJobData = await (0, aiService_1.analyzeJobDescription)(data.jobDescription.rawText);
                prep.jobDescription.parsedData = parsedJobData;
                await prep.save();
                const studyPlanResult = await generateStudyPlanAndContent(prep._id, user._id, parsedJobData, new Date(data.interviewDate), data.dailyStudyTime, data.learningStyle);
                prep.studyPlan = studyPlanResult;
                prep.status = types_1.PrepStatus.ACTIVE;
                prep.analysisStatus = types_1.AnalysisStatus.COMPLETED;
                const totalTopicsCount = prep.studyPlan.dailySchedule.flatMap((day) => day.topics).length;
                prep.progress.totalTopics = totalTopicsCount;
                prep.progress.overallPercentage = totalTopicsCount > 0 ? 0 : 100;
                await prep.save();
                await (0, emailService_1.sendEmail)({
                    to: user.email,
                    subject: 'Your Interview Prep is Ready!',
                    html: `<p>Your interview preparation for <b>${parsedJobData.jobTitle}</b> at <b>${parsedJobData.company}</b> is ready! Log in to start studying.</p>`,
                });
                break;
            }
            case 'adjust-study-plan': {
                parsedJobData = data.jobDescription; // already parsed
                await Topic_1.default.deleteMany({ interviewPrepId: prep._id });
                await Flashcard_1.default.deleteMany({ userId: user._id, topicId: { $in: prep.studyPlan.dailySchedule.flatMap((day) => day.topics.map((t) => t.topicId)) } });
                const adjustedStudyPlanResult = await generateStudyPlanAndContent(prep._id, user._id, parsedJobData, new Date(data.interviewDate), data.dailyStudyTime, data.learningStyle);
                prep.studyPlan = adjustedStudyPlanResult;
                const newTotalTopicsCount = prep.studyPlan.dailySchedule.flatMap((day) => day.topics).length;
                prep.progress.totalTopics = newTotalTopicsCount;
                prep.progress.topicsCompleted = 0;
                prep.progress.overallPercentage = newTotalTopicsCount > 0 ? 0 : 100;
                prep.analysisStatus = types_1.AnalysisStatus.COMPLETED;
                await prep.save();
                await (0, emailService_1.sendEmail)({
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
    }
    catch (error) {
        console.error(`[QueueService] Error handling job of type ${type}:`, error?.message || error);
        // Mark as failed in DB so the recovery scan won't loop it indefinitely
        try {
            const failedPrep = await InterviewPrep_1.default.findById(data.prepId);
            if (failedPrep && failedPrep.analysisStatus !== types_1.AnalysisStatus.COMPLETED) {
                failedPrep.analysisStatus = types_1.AnalysisStatus.FAILED;
                await failedPrep.save();
            }
        }
        catch (saveErr) {
            console.error('[QueueService] Could not persist FAILED status:', saveErr?.message);
        }
        // Note: when using Bull, retries/attempts will be handled by Bull configuration
        throw error;
    }
};
exports.handleJob = handleJob;
const consumer = async () => {
    if (isProcessing || jobQueue.length === 0) {
        return;
    }
    isProcessing = true;
    const job = jobQueue.shift(); // Get the next job from the queue
    if (job) {
        try {
            await (0, exports.handleJob)(job.type, job.data);
            job.status = 'completed';
            jobProcessor.emit('job:completed', job);
        }
        catch (err) {
            job.status = 'failed';
            job.retries++;
            if (job.retries < job.maxRetries) {
                jobQueue.unshift(job);
                jobProcessor.emit('job:retrying', job);
            }
            else {
                jobProcessor.emit('job:failed', job);
            }
        }
    }
    isProcessing = false;
};
// Start the consumer at regular intervals
let consumerInterval;
exports.jobQueueService = {
    add: (type, data, maxRetries = 3) => {
        if (useBull && bullAvailable && bullQueue) {
            // Add job to Bull queue with attempts for retries
            bullQueue.add(type, data, { attempts: maxRetries, backoff: { type: 'exponential', delay: 2000 } });
            console.log(`[QueueService] Added job to Bull queue of type ${type}`);
            return;
        }
        const newJob = {
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
                const worker = new BullWorker('prep-jobs', async (job) => {
                    console.log('[QueueService] Bull worker processing job', job.name);
                    await (0, exports.handleJob)(job.name, job.data);
                }, { connection: { url: redisUrl } });
                console.log('[QueueService] Bull worker started in-process.');
                return;
            }
            catch (err) {
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
