"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logVoiceStudySession = exports.synthesizeContent = void 0;
const ttsService_1 = require("../services/ttsService");
const UserProgress_1 = __importDefault(require("../models/UserProgress"));
const types_1 = require("../types");
const validators_1 = require("../utils/validators");
const quotaService_1 = require("../services/quotaService");
const estimateVoiceMinutes = (text) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.ceil(words / 130);
    return Math.max(1, minutes);
};
const synthesizeContent = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { text, voiceSettings } = req.body;
        if (!text) {
            return res.status(400).json({ message: 'Text content is required for synthesis' });
        }
        const estimatedMinutes = estimateVoiceMinutes(text);
        const quota = await (0, quotaService_1.checkFeatureQuota)(req.user, 'voiceMinutes', estimatedMinutes);
        if (!quota.allowed) {
            return res.status(403).json({
                error: 'Voice minutes quota exceeded for your current plan',
                code: 'quota_exceeded',
                feature: quota.feature,
                limit: quota.limit,
                used: quota.used,
                remaining: quota.remaining,
                plan: quota.plan,
            });
        }
        const audioContent = await (0, ttsService_1.synthesizeSpeech)(text, voiceSettings);
        await (0, quotaService_1.consumeFeatureQuota)(req.user._id, 'voiceMinutes', estimatedMinutes);
        res.status(200).json({ audioContent });
    }
    catch (err) {
        next(err);
    }
};
exports.synthesizeContent = synthesizeContent;
const logVoiceStudySession = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { error, value } = validators_1.logActivitySchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const { prepId, duration, topicsListened } = value; // topicsListened can be part of metadata
        await UserProgress_1.default.create({
            userId: req.user._id,
            interviewPrepId: prepId,
            date: new Date(),
            activities: [{
                    type: types_1.ActivityType.VOICE_SESSION,
                    duration: duration,
                    metadata: { topicsListened: topicsListened }
                }],
            dailyGoalMet: false, // Will be calculated by a separate service or cron
            streakCount: 0, // Will be calculated by a separate service or cron
        });
        res.status(200).json({ message: 'Voice study session logged successfully' });
    }
    catch (err) {
        next(err);
    }
};
exports.logVoiceStudySession = logVoiceStudySession;
