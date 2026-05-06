"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const ChatbotReminderSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prepId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'InterviewPrep', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 1200 },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
        required: true,
    },
    channels: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: false },
    },
    scheduledFor: { type: Date, required: true, index: true },
    status: {
        type: String,
        enum: ['scheduled', 'sent', 'dismissed', 'failed'],
        default: 'scheduled',
        required: true,
        index: true,
    },
    deliveredAt: { type: Date },
    dismissedAt: { type: Date },
    delivery: {
        emailSentAt: { type: Date },
        pushAttemptedAt: { type: Date },
        inAppAvailableAt: { type: Date },
        lastError: { type: String },
    },
}, { timestamps: true });
ChatbotReminderSchema.index({ userId: 1, status: 1, scheduledFor: 1 });
ChatbotReminderSchema.index({ prepId: 1, scheduledFor: -1 });
exports.default = (0, mongoose_1.model)('ChatbotReminder', ChatbotReminderSchema);
