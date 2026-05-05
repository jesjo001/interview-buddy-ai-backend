"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMindMapByTopicId = exports.getMindMapByPrepId = exports.getMindMapByTopicId = void 0;
const Topic_1 = __importDefault(require("../models/Topic"));
const InterviewPrep_1 = __importDefault(require("../models/InterviewPrep"));
const getMindMapByTopicId = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { topicId } = req.params;
        const topic = await Topic_1.default.findById(topicId);
        if (!topic) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        // Ensure the topic belongs to a prep that belongs to the user
        const prep = await InterviewPrep_1.default.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
        if (!prep) {
            return res.status(401).json({ message: 'Unauthorized to access this mind map' });
        }
        res.status(200).json(topic.mindMap);
    }
    catch (err) {
        next(err);
    }
};
exports.getMindMapByTopicId = getMindMapByTopicId;
const getMindMapByPrepId = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { prepId } = req.params;
        const userId = req.user._id;
        // Verify the prep belongs to the user
        const prep = await InterviewPrep_1.default.findOne({ _id: prepId, userId });
        if (!prep) {
            return res.status(404).json({ message: 'Interview prep not found or not authorized' });
        }
        const topics = await Topic_1.default.find({ interviewPrepId: prepId });
        // Combine mind maps from all topics
        const combinedMindMap = {
            nodes: topics.flatMap(topic => topic.mindMap?.nodes || []),
            edges: topics.flatMap(topic => topic.mindMap?.edges || []),
        };
        res.status(200).json(combinedMindMap);
    }
    catch (err) {
        next(err);
    }
};
exports.getMindMapByPrepId = getMindMapByPrepId;
const updateMindMapByTopicId = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { topicId } = req.params;
        const { nodes, edges } = req.body; // Expecting updated mind map structure
        if (!nodes || !edges) {
            return res.status(400).json({ message: 'Nodes and edges are required for mind map update' });
        }
        const topic = await Topic_1.default.findById(topicId);
        if (!topic) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        // Ensure the topic belongs to a prep that belongs to the user
        const prep = await InterviewPrep_1.default.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
        if (!prep) {
            return res.status(401).json({ message: 'Unauthorized to update this mind map' });
        }
        topic.mindMap = { nodes, edges };
        await topic.save();
        res.status(200).json({ message: 'Mind map updated successfully', mindMap: topic.mindMap });
    }
    catch (err) {
        next(err);
    }
};
exports.updateMindMapByTopicId = updateMindMapByTopicId;
