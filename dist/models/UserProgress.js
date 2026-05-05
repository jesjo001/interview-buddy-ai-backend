"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const types_1 = require("../types");
const UserProgressSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    interviewPrepId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'InterviewPrep', required: true },
    date: { type: Date, required: true },
    activities: [
        {
            type: { type: String, enum: Object.values(types_1.ActivityType), required: true },
            timestamp: { type: Date, default: Date.now },
            duration: { type: Number },
            metadata: { type: mongoose_1.Schema.Types.Mixed }, // Use Mixed for flexible metadata
        },
    ],
    dailyGoalMet: { type: Boolean, default: false },
    streakCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});
exports.default = (0, mongoose_1.model)('UserProgress', UserProgressSchema);
