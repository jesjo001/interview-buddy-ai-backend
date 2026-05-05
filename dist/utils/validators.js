"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivitySchema = exports.reviewFlashcardSchema = exports.updateFlashcardSchema = exports.createFlashcardSchema = exports.updateTopicMasterySchema = exports.updateInterviewPrepSchema = exports.createInterviewPrepSchema = exports.updatePreferencesSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.registerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const types_1 = require("../types");
// Register Schema
exports.registerSchema = joi_1.default.object({
    name: joi_1.default.string().min(3).max(30).required(),
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(8).required(),
});
// Login Schema
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required(),
});
// Forgot Password Schema
exports.forgotPasswordSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
});
// Reset Password Schema
exports.resetPasswordSchema = joi_1.default.object({
    token: joi_1.default.string().required(),
    newPassword: joi_1.default.string().min(8).required(),
});
// Update User Preferences Schema
exports.updatePreferencesSchema = joi_1.default.object({
    learningStyle: joi_1.default.string().valid(...Object.values(types_1.LearningStyle)).optional(),
    dailyStudyTime: joi_1.default.number().min(10).max(240).optional(),
    voiceEnabled: joi_1.default.boolean().optional(),
    language: joi_1.default.string().optional(),
});
// Create Interview Prep Schema
exports.createInterviewPrepSchema = joi_1.default.object({
    jobDescription: joi_1.default.string().required(),
    interviewDate: joi_1.default.date().iso().min('now').required(),
    preferences: joi_1.default.object({
        dailyStudyTime: joi_1.default.number().min(10).max(240).optional(),
        learningStyle: joi_1.default.string().valid(...Object.values(types_1.LearningStyle)).optional(),
    }).optional(),
});
// Update Interview Prep Schema
exports.updateInterviewPrepSchema = joi_1.default.object({
    jobDescription: joi_1.default.string().optional(),
    interviewDate: joi_1.default.date().iso().min('now').optional(),
    status: joi_1.default.string().valid(...Object.values(types_1.PrepStatus)).optional(),
    preferences: joi_1.default.object({
        dailyStudyTime: joi_1.default.number().min(10).max(240).optional(),
        learningStyle: joi_1.default.string().valid(...Object.values(types_1.LearningStyle)).optional(),
    }).optional(),
});
// Update Topic Mastery Level Schema
exports.updateTopicMasterySchema = joi_1.default.object({
    masteryLevel: joi_1.default.number().min(0).max(100).required(),
});
// Create Flashcard Schema
exports.createFlashcardSchema = joi_1.default.object({
    topicId: joi_1.default.string().hex().length(24).required(),
    front: joi_1.default.string().required(),
    back: joi_1.default.string().required(),
});
// Update Flashcard Schema
exports.updateFlashcardSchema = joi_1.default.object({
    front: joi_1.default.string().optional(),
    back: joi_1.default.string().optional(),
});
// Flashcard Review Schema
exports.reviewFlashcardSchema = joi_1.default.object({
    rating: joi_1.default.string().valid('again', 'hard', 'good', 'easy').required(),
    timeSpent: joi_1.default.number().min(0).optional(),
});
// Log Activity Schema
exports.logActivitySchema = joi_1.default.object({
    prepId: joi_1.default.string().hex().length(24).required(),
    activityType: joi_1.default.string().valid(...Object.values(types_1.ActivityType)).required(),
    duration: joi_1.default.number().min(0).optional(),
    metadata: joi_1.default.object().optional(),
});
