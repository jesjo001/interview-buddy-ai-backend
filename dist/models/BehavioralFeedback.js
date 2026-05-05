"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const VideoMetricsSchema = new mongoose_1.Schema({
    eyeContactScore: { type: Number, min: 0, max: 100, required: true },
    fillerWordsCount: { type: Number, default: 0 },
    averagePauseDuration: { type: Number, default: 0 },
    speakingPace: { type: Number, default: 0 },
    confidenceScore: { type: Number, min: 0, max: 100, required: true },
    emotionTimeline: [
        {
            timestamp: { type: Number, required: true },
            emotion: {
                type: String,
                enum: ['confident', 'uncertain', 'stressed', 'calm', 'confused'],
                required: true
            },
            confidenceLevel: { type: Number, min: 0, max: 100, required: true },
        },
    ],
});
const STARAnalysisSchema = new mongoose_1.Schema({
    situation: {
        score: { type: Number, min: 0, max: 100, required: true },
        feedback: { type: String, required: true },
        strength: { type: String },
        improvement: { type: String },
    },
    task: {
        score: { type: Number, min: 0, max: 100, required: true },
        feedback: { type: String, required: true },
        strength: { type: String },
        improvement: { type: String },
    },
    action: {
        score: { type: Number, min: 0, max: 100, required: true },
        feedback: { type: String, required: true },
        strength: { type: String },
        improvement: { type: String },
    },
    result: {
        score: { type: Number, min: 0, max: 100, required: true },
        feedback: { type: String, required: true },
        strength: { type: String },
        improvement: { type: String },
    },
    overallSTARScore: { type: Number, min: 0, max: 100, required: true },
});
const RecommendationSchema = new mongoose_1.Schema({
    category: {
        type: String,
        enum: ['eye-contact', 'filler-words', 'pacing', 'structure', 'confidence', 'technical-depth', 'clarity'],
        required: true,
    },
    priority: { type: Number, min: 1, max: 5, required: true },
    suggestion: { type: String, required: true },
    practiceExercise: { type: String, required: true },
    expectedImprovement: { type: String, required: true },
    resourceLink: { type: String },
});
const BehavioralFeedbackSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mockInterviewId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'MockInterview', required: true, index: true, unique: true },
    videoMetrics: VideoMetricsSchema,
    starAnalysis: STARAnalysisSchema,
    recommendations: [RecommendationSchema],
    overallCommunicationScore: { type: Number, min: 0, max: 100, required: true },
    overallBehavioralScore: { type: Number, min: 0, max: 100, required: true },
    keyStrengths: [{ type: String }],
    areasForImprovement: [{ type: String }],
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });
// Indexes
BehavioralFeedbackSchema.index({ userId: 1, createdAt: -1 });
BehavioralFeedbackSchema.index({ overallBehavioralScore: -1, createdAt: -1 }); // For progress tracking
exports.default = (0, mongoose_1.model)('BehavioralFeedback', BehavioralFeedbackSchema);
