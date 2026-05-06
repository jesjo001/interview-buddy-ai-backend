"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustStudyPlan = exports.analyzeJobDescriptionManually = exports.deleteInterviewPrep = exports.updateInterviewPrep = exports.getInterviewPrepById = exports.getInterviewPreps = exports.createInterviewPrep = void 0;
const InterviewPrep_1 = __importDefault(require("../models/InterviewPrep"));
const Topic_1 = __importDefault(require("../models/Topic"));
const Flashcard_1 = __importDefault(require("../models/Flashcard"));
const validators_1 = require("../utils/validators");
const aiService_1 = require("../services/aiService");
const queueService_1 = require("../services/queueService");
const helpers_1 = require("../utils/helpers");
const types_1 = require("../types");
const fileService_1 = require("../services/fileService");
const quotaService_1 = require("../services/quotaService");
// Helper function for study plan generation (can be moved to a service)
const generateStudyPlan = async (prepId, userId, parsedData, // JobParsedData
interviewDate, dailyStudyTime, learningStyle // Assuming 'visual', 'auditory', 'kinesthetic'
) => {
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
        // Distribute topics roughly evenly, respecting daily study time
        while (estimatedTimeForDay < dailyStudyTime && topicIndex < allTopicsToCover.length) {
            const topicTitle = allTopicsToCover[topicIndex];
            const estimatedTopicTime = 30; // Assume 30 min per topic for now
            if (estimatedTimeForDay + estimatedTopicTime <= dailyStudyTime) {
                // Generate content for the topic
                const aiTopicContent = await (0, aiService_1.generateTopicContent)(topicTitle, types_1.TopicDifficulty.INTERMEDIATE);
                const { mindMap, ...content } = aiTopicContent;
                // Create the topic in DB
                //@ts-ignore
                const newTopic = await Topic_1.default.create({
                    interviewPrepId: prepId,
                    title: topicTitle,
                    category: skillTopics.includes(topicTitle) ? 'Technical Skills' : 'Behavioral',
                    difficulty: types_1.TopicDifficulty.INTERMEDIATE,
                    content,
                    mindMap,
                    masteryLevel: 0,
                });
                // Generate flashcards for the topic
                const aiFlashcards = await (0, aiService_1.generateFlashcards)(aiTopicContent.deepDive || aiTopicContent.summary, 5); // Generate 5 flashcards
                await Flashcard_1.default.insertMany(aiFlashcards.map(card => ({
                    //@ts-ignore
                    topicId: newTopic?._id,
                    userId: userId,
                    front: card.front,
                    back: card.back,
                    difficulty: 'medium', // Default difficulty
                    reviewSchedule: {
                        nextReview: today, // Due today
                        interval: 1,
                        repetitions: 0,
                        easeFactor: 2.5,
                    },
                    reviewHistory: [],
                })));
                dayTopics.push({
                    //@ts-ignore
                    topicId: newTopic?._id,
                    estimatedTime: estimatedTopicTime,
                    completed: false,
                });
                estimatedTimeForDay += estimatedTopicTime;
                topicIndex++;
            }
            else {
                break; // Move to next day if current topic won't fit
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
const createInterviewPrep = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const quota = await (0, quotaService_1.checkFeatureQuota)(req.user, 'interviewPrepCreate', 1);
        if (!quota.allowed) {
            return res.status(403).json({
                error: 'Interview prep quota exceeded for your current plan',
                code: 'quota_exceeded',
                feature: quota.feature,
                limit: quota.limit,
                used: quota.used,
                remaining: quota.remaining,
                plan: quota.plan,
            });
        }
        // Handle file upload separately or ensure req.body contains text
        let jobDescriptionText = req.body.jobDescription;
        let fileUrl = undefined;
        if (req.file) {
            fileUrl = await (0, fileService_1.uploadToS3)(req.file);
            if (req.file.mimetype === 'application/pdf') {
                jobDescriptionText = await (0, fileService_1.extractTextFromPDF)(req.file.buffer);
            }
            else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                jobDescriptionText = await (0, fileService_1.extractTextFromDOCX)(req.file.buffer);
            }
        }
        const { error, value } = validators_1.createInterviewPrepSchema.validate({
            jobDescription: jobDescriptionText,
            interviewDate: req.body.interviewDate,
            preferences: req.body.preferences,
        });
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const { interviewDate, preferences } = value;
        const newPrep = await InterviewPrep_1.default.create({
            userId: req.user._id,
            jobDescription: {
                rawText: jobDescriptionText,
                fileUrl: fileUrl,
            },
            interviewDate,
            studyPlan: {
                startDate: new Date(),
                totalDays: (0, helpers_1.calculateDaysBetween)(new Date(), interviewDate),
                dailySchedule: [],
            },
            progress: {}, // Default empty progress
            status: types_1.PrepStatus.ACTIVE,
        });
        // Add job to queue for AI processing
        queueService_1.jobQueueService.add('analyze-job-description', {
            prepId: newPrep._id,
            jobDescription: { rawText: jobDescriptionText, fileUrl: fileUrl },
            interviewDate: interviewDate,
            userId: req.user._id,
            dailyStudyTime: preferences?.dailyStudyTime || req.user.preferences.dailyStudyTime,
            learningStyle: preferences?.learningStyle || req.user.preferences.learningStyle,
        });
        await (0, quotaService_1.consumeFeatureQuota)(req.user._id, 'interviewPrepCreate', 1);
        res.status(201).json({
            message: 'Interview prep created. AI analysis and study plan generation started in background.',
            prepId: newPrep._id,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.createInterviewPrep = createInterviewPrep;
const getInterviewPreps = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const preps = await InterviewPrep_1.default.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json(preps);
    }
    catch (err) {
        next(err);
    }
};
exports.getInterviewPreps = getInterviewPreps;
const getInterviewPrepById = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params;
        const prep = await InterviewPrep_1.default.findOne({ _id: id, userId: req.user._id })
            .populate({
            path: 'studyPlan.dailySchedule.topics.topicId',
            model: 'Topic',
            select: 'title category difficulty masteryLevel content.summary' // Populate only necessary fields
        });
        if (!prep) {
            return res.status(404).json({ message: 'Interview prep not found' });
        }
        res.status(200).json(prep);
    }
    catch (err) {
        next(err);
    }
};
exports.getInterviewPrepById = getInterviewPrepById;
const updateInterviewPrep = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params;
        const { error, value } = validators_1.updateInterviewPrepSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const { interviewDate, preferences, status } = value;
        const prep = await InterviewPrep_1.default.findOne({ _id: id, userId: req.user._id });
        if (!prep) {
            return res.status(404).json({ message: 'Interview prep not found' });
        }
        if (interviewDate)
            prep.interviewDate = interviewDate;
        if (status)
            prep.status = status;
        if (preferences) {
            // Update preferences directly in user model or store in prep if it's prep-specific
            // For now, let's assume prep-specific overrides user preferences
            // Or update user preferences based on this prep if it's the primary prep
            if (preferences.dailyStudyTime) {
                // Potentially update user's default dailyStudyTime
                req.user.preferences.dailyStudyTime = preferences.dailyStudyTime;
                await req.user.save();
            }
            if (preferences.learningStyle) {
                req.user.preferences.learningStyle = preferences.learningStyle;
                await req.user.save();
            }
        }
        await prep.save();
        res.status(200).json({ message: 'Interview prep updated successfully', prep });
    }
    catch (err) {
        next(err);
    }
};
exports.updateInterviewPrep = updateInterviewPrep;
const deleteInterviewPrep = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params;
        const prep = await InterviewPrep_1.default.findOneAndDelete({ _id: id, userId: req.user._id });
        if (!prep) {
            return res.status(404).json({ message: 'Interview prep not found' });
        }
        // Cascade delete: Remove associated Topics, Flashcards, and UserProgress
        await Topic_1.default.deleteMany({ interviewPrepId: id });
        await Flashcard_1.default.deleteMany({ topicId: { $in: prep.studyPlan.dailySchedule.flatMap(day => day.topics.map(t => t.topicId)) } });
        // await UserProgress.deleteMany({ interviewPrepId: id }); // Uncomment when UserProgress is fully implemented
        res.status(200).json({ message: 'Interview prep and associated data deleted successfully' });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteInterviewPrep = deleteInterviewPrep;
const analyzeJobDescriptionManually = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params;
        const prep = await InterviewPrep_1.default.findOne({ _id: id, userId: req.user._id });
        if (!prep) {
            return res.status(404).json({ message: 'Interview prep not found' });
        }
        // Clear existing topics and flashcards before re-analysis
        await Topic_1.default.deleteMany({ interviewPrepId: id });
        // This will require getting all topicIds linked to this prep first before deleting flashcards
        // For now, simplify and assume flashcards are deleted with topics
        const topicIdsToDelete = prep.studyPlan.dailySchedule.flatMap(day => day.topics.map(t => t.topicId));
        await Flashcard_1.default.deleteMany({ topicId: { $in: topicIdsToDelete } });
        // Trigger AI analysis and study plan generation again
        queueService_1.jobQueueService.add('analyze-job-description', {
            prepId: prep._id,
            jobDescription: { rawText: prep.jobDescription.rawText, fileUrl: prep.jobDescription.fileUrl },
            interviewDate: prep.interviewDate,
            userId: req.user._id,
            dailyStudyTime: req.user.preferences.dailyStudyTime,
            learningStyle: req.user.preferences.learningStyle,
        });
        res.status(202).json({ message: 'Re-analysis of job description started in background.' });
    }
    catch (err) {
        next(err);
    }
};
exports.analyzeJobDescriptionManually = analyzeJobDescriptionManually;
const adjustStudyPlan = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params;
        const { newInterviewDate } = req.body; // Expecting a new interview date
        const prep = await InterviewPrep_1.default.findOne({ _id: id, userId: req.user._id });
        if (!prep) {
            return res.status(404).json({ message: 'Interview prep not found' });
        }
        if (!newInterviewDate) {
            return res.status(400).json({ message: 'newInterviewDate is required' });
        }
        // Update the interview date
        prep.interviewDate = new Date(newInterviewDate);
        if (!prep.jobDescription.parsedData) {
            return res.status(400).json({ message: 'Job description has not been analyzed yet. Cannot adjust study plan.' });
        }
        // Trigger study plan regeneration in background
        queueService_1.jobQueueService.add('adjust-study-plan', {
            prepId: prep._id,
            jobDescription: prep.jobDescription.parsedData, // Use parsed data
            interviewDate: prep.interviewDate,
            userId: req.user._id,
            dailyStudyTime: req.user.preferences.dailyStudyTime,
            learningStyle: req.user.preferences.learningStyle,
        });
        await prep.save();
        res.status(202).json({ message: 'Study plan adjustment started in background.' });
    }
    catch (err) {
        next(err);
    }
};
exports.adjustStudyPlan = adjustStudyPlan;
