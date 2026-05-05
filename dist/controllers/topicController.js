"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTopic = exports.updateTopicMasteryLevel = exports.markTopicAsComplete = exports.getTopicById = exports.getTopicsByPrepId = void 0;
const Topic_1 = __importDefault(require("../models/Topic"));
const InterviewPrep_1 = __importDefault(require("../models/InterviewPrep"));
const validators_1 = require("../utils/validators");
const getTopicsByPrepId = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { prepId } = req.params;
        // Ensure the prep belongs to the user
        const prep = await InterviewPrep_1.default.findOne({ _id: prepId, userId: req.user._id });
        if (!prep) {
            return res.status(404).json({ message: 'Interview prep not found or not authorized' });
        }
        const topics = await Topic_1.default.find({ interviewPrepId: prepId }).sort({ createdAt: 1 });
        res.status(200).json(topics);
    }
    catch (err) {
        next(err);
    }
};
exports.getTopicsByPrepId = getTopicsByPrepId;
const getTopicById = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params;
        const topic = await Topic_1.default.findById(id);
        if (!topic) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        // Ensure the topic belongs to a prep that belongs to the user
        const prep = await InterviewPrep_1.default.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
        if (!prep) {
            return res.status(401).json({ message: 'Unauthorized to access this topic' });
        }
        res.status(200).json(topic);
    }
    catch (err) {
        next(err);
    }
};
exports.getTopicById = getTopicById;
const markTopicAsComplete = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params; // topic ID
        const topic = await Topic_1.default.findById(id);
        if (!topic) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        const prep = await InterviewPrep_1.default.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
        if (!prep) {
            return res.status(401).json({ message: 'Unauthorized to modify this topic' });
        }
        // Find the topic in the prep's daily schedule and mark it as completed
        let topicFoundAndUpdated = false;
        for (const day of prep.studyPlan.dailySchedule) {
            const scheduleTopic = day.topics.find(t => t.topicId.equals(id));
            if (scheduleTopic) {
                if (!scheduleTopic.completed) {
                    scheduleTopic.completed = true;
                    scheduleTopic.completedAt = new Date();
                    topicFoundAndUpdated = true;
                    break;
                }
                else {
                    // Already completed, no change needed
                    return res.status(200).json({ message: 'Topic already marked as complete', topic });
                }
            }
        }
        if (!topicFoundAndUpdated) {
            return res.status(400).json({ message: 'Topic not found in study plan schedule' });
        }
        // Update prep's progress
        prep.progress.topicsCompleted = (prep.progress.topicsCompleted || 0) + 1;
        prep.progress.overallPercentage = Math.round((prep.progress.topicsCompleted / prep.progress.totalTopics) * 100);
        await prep.save();
        // await topic.save(); // No need to save topic itself, only prep.
        res.status(200).json({ message: 'Topic marked as complete and prep progress updated', prepProgress: prep.progress });
    }
    catch (err) {
        next(err);
    }
};
exports.markTopicAsComplete = markTopicAsComplete;
const updateTopicMasteryLevel = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params; // topic ID
        const { error, value } = validators_1.updateTopicMasterySchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const { masteryLevel } = value;
        const topic = await Topic_1.default.findById(id);
        if (!topic) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        // Ensure the topic belongs to a prep that belongs to the user
        const prep = await InterviewPrep_1.default.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
        if (!prep) {
            return res.status(401).json({ message: 'Unauthorized to modify this topic' });
        }
        topic.masteryLevel = masteryLevel;
        await topic.save();
        res.status(200).json({ message: 'Topic mastery level updated', topic });
    }
    catch (err) {
        next(err);
    }
};
exports.updateTopicMasteryLevel = updateTopicMasteryLevel;
const updateTopic = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params;
        const { notes } = req.body;
        const topic = await Topic_1.default.findById(id);
        if (!topic) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        const prep = await InterviewPrep_1.default.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
        if (!prep) {
            return res.status(401).json({ message: 'Unauthorized to modify this topic' });
        }
        if (notes !== undefined) {
            topic.notes = notes;
        }
        await topic.save();
        res.status(200).json({ message: 'Topic updated successfully', topic });
    }
    catch (err) {
        next(err);
    }
};
exports.updateTopic = updateTopic;
