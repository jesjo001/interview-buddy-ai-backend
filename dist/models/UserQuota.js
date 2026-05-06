"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserQuotaSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    periodKey: { type: String, required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    usage: {
        interviewPrepCreate: { type: Number, default: 0, min: 0 },
        mockInterviewStart: { type: Number, default: 0, min: 0 },
        voiceMinutes: { type: Number, default: 0, min: 0 },
        chatbotMessage: { type: Number, default: 0, min: 0 },
    },
}, { timestamps: true });
UserQuotaSchema.index({ userId: 1, periodKey: 1 }, { unique: true });
exports.default = (0, mongoose_1.model)('UserQuota', UserQuotaSchema);
