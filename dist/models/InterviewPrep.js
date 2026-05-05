"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const types_1 = require("../types");
const InterviewPrepSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    jobDescription: {
        rawText: { type: String, required: true },
        fileUrl: { type: String },
        parsedData: {
            jobTitle: { type: String },
            company: { type: String },
            requiredSkills: [{ type: String }],
            preferredSkills: [{ type: String }],
            responsibilities: [{ type: String }],
            qualifications: [{ type: String }],
        },
    },
    interviewDate: { type: Date, required: true },
    studyPlan: {
        startDate: { type: Date, required: true },
        totalDays: { type: Number, required: true },
        dailySchedule: [
            {
                day: { type: Number },
                date: { type: Date },
                topics: [
                    {
                        topicId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Topic' },
                        estimatedTime: { type: Number },
                        completed: { type: Boolean, default: false },
                        completedAt: { type: Date },
                    },
                ],
            },
        ],
    },
    progress: {
        overallPercentage: { type: Number, default: 0 },
        topicsCompleted: { type: Number, default: 0 },
        totalTopics: { type: Number, default: 0 },
        flashcardsReviewed: { type: Number, default: 0 },
        totalFlashcards: { type: Number, default: 0 },
        timeSpent: { type: Number, default: 0 },
    },
    status: { type: String, enum: Object.values(types_1.PrepStatus), default: types_1.PrepStatus.ACTIVE },
    analysisStatus: { type: String, enum: Object.values(types_1.AnalysisStatus), default: types_1.AnalysisStatus.PENDING },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
// Indexes to speed up common queries
InterviewPrepSchema.index({ userId: 1, interviewDate: 1 });
InterviewPrepSchema.index({ 'jobDescription.parsedData.jobTitle': 1 });
exports.default = (0, mongoose_1.model)('InterviewPrep', InterviewPrepSchema);
