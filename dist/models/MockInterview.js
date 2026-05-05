"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewStatus = exports.InterviewDifficulty = exports.InterviewType = void 0;
const mongoose_1 = require("mongoose");
var InterviewType;
(function (InterviewType) {
    InterviewType["TECHNICAL"] = "technical";
    InterviewType["BEHAVIORAL"] = "behavioral";
    InterviewType["SYSTEM_DESIGN"] = "system-design";
    InterviewType["MIXED"] = "mixed";
})(InterviewType || (exports.InterviewType = InterviewType = {}));
var InterviewDifficulty;
(function (InterviewDifficulty) {
    InterviewDifficulty["EASY"] = "easy";
    InterviewDifficulty["MEDIUM"] = "medium";
    InterviewDifficulty["HARD"] = "hard";
})(InterviewDifficulty || (exports.InterviewDifficulty = InterviewDifficulty = {}));
var InterviewStatus;
(function (InterviewStatus) {
    InterviewStatus["IN_PROGRESS"] = "in-progress";
    InterviewStatus["COMPLETED"] = "completed";
    InterviewStatus["ABANDONED"] = "abandoned";
})(InterviewStatus || (exports.InterviewStatus = InterviewStatus = {}));
const QuestionResponseSchema = new mongoose_1.Schema({
    questionId: { type: String, required: true },
    question: { type: String, required: true },
    askedAt: { type: Date, default: Date.now },
    userResponse: { type: String, required: true },
    responseAudioUrl: { type: String },
    responseVideoUrl: { type: String },
    responseDuration: { type: Number, required: true },
    transcript: { type: String, default: '' },
    aiAnalysis: {
        clarity: { type: Number, min: 0, max: 100, required: true },
        completeness: { type: Number, min: 0, max: 100, required: true },
        technicalAccuracy: { type: Number, min: 0, max: 100, required: true },
        communicationSkill: { type: Number, min: 0, max: 100, required: true },
        relevance: { type: Number, min: 0, max: 100, required: true },
        feedback: { type: String, required: true },
        suggestedImprovement: { type: String, required: true },
    },
    timestamp: { type: Date, default: Date.now },
});
const MockInterviewSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prepId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'InterviewPrep', required: true, index: true },
    interviewType: {
        type: String,
        enum: Object.values(InterviewType),
        default: InterviewType.TECHNICAL,
        required: true
    },
    difficulty: {
        type: String,
        enum: Object.values(InterviewDifficulty),
        default: InterviewDifficulty.MEDIUM,
        required: true
    },
    duration: { type: Number, required: true },
    questions: [QuestionResponseSchema],
    overallScore: { type: Number, min: 0, max: 100, default: 0 },
    videoRecordingUrl: { type: String },
    fullTranscript: { type: String, default: '' },
    status: {
        type: String,
        enum: Object.values(InterviewStatus),
        default: InterviewStatus.IN_PROGRESS,
        required: true,
        index: true
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    summary: {
        strengths: [{ type: String }],
        weaknesses: [{ type: String }],
        recommendations: [{ type: String }],
    },
    completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });
// Indexes for performance
MockInterviewSchema.index({ userId: 1, createdAt: -1 });
MockInterviewSchema.index({ prepId: 1, status: 1 });
MockInterviewSchema.index({ overallScore: -1, createdAt: -1 }); // For leaderboards
exports.default = (0, mongoose_1.model)('MockInterview', MockInterviewSchema);
