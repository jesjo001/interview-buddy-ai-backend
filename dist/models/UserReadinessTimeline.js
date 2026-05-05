"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserReadinessTimelineSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prepId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'InterviewPrep', required: true, index: true },
    readinessScore: { type: Number, min: 0, max: 100, required: true },
    confidence: { type: Number, min: 0, max: 100, required: true },
    metrics: {
        mockInterviewScore: { type: Number, min: 0, max: 100, default: 0 },
        flashcardAccuracy: { type: Number, min: 0, max: 100, default: 0 },
        topicsCompleted: { type: Number, default: 0 },
        topicsTotal: { type: Number, default: 0 },
        daysRemaining: { type: Number, default: 0 },
        hoursInvested: { type: Number, default: 0 },
        consistencyStreak: { type: Number, default: 0 },
    },
    recommendation: { type: String, default: '' },
    focusAreas: [{ type: String }],
    predictedOutcome: {
        passLikelihood: { type: Number, min: 0, max: 100, required: true },
        estimatedScore: { type: Number, min: 0, max: 100, required: true },
        timeNeededToImprove: { type: Number, default: 0 },
    },
    snapshot_date: { type: Date, required: true, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false });
// Indexes for trending analysis
UserReadinessTimelineSchema.index({ userId: 1, prepId: 1, snapshot_date: -1 });
UserReadinessTimelineSchema.index({ prepId: 1, snapshot_date: -1 });
exports.default = (0, mongoose_1.model)('UserReadinessTimeline', UserReadinessTimelineSchema);
