"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const types_1 = require("../types");
const UserSchema = new mongoose_1.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    avatar: { type: String, default: '' },
    subscription: {
        plan: { type: String, enum: Object.values(types_1.SubscriptionPlan), default: types_1.SubscriptionPlan.FREE },
        status: { type: String, enum: Object.values(types_1.SubscriptionStatus), default: types_1.SubscriptionStatus.ACTIVE },
        validUntil: { type: Date },
        stripeCustomerId: { type: String },
        stripeSubscriptionId: { type: String }
    },
    preferences: {
        learningStyle: { type: String, enum: Object.values(types_1.LearningStyle), default: types_1.LearningStyle.VISUAL },
        dailyStudyTime: { type: Number, default: 60 },
        voiceEnabled: { type: Boolean, default: true },
        language: { type: String, default: 'en' },
        copilotPersona: {
            type: String,
            enum: ['coach', 'recruiter', 'study-buddy'],
            default: 'coach',
        },
        reminderChannels: {
            inApp: { type: Boolean, default: true },
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: false },
        },
    },
    refreshTokens: [{ type: String }],
    emailVerified: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
exports.default = (0, mongoose_1.model)('User', UserSchema);
