import Joi from 'joi';
import { ActivityType, LearningStyle, PrepStatus, TopicDifficulty } from '../types';

// Register Schema
export const registerSchema = Joi.object({
  name: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

// Login Schema
export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Forgot Password Schema
export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

// Reset Password Schema
export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

// Update User Preferences Schema
export const updatePreferencesSchema = Joi.object({
  learningStyle: Joi.string().valid(...Object.values(LearningStyle)).optional(),
  dailyStudyTime: Joi.number().min(10).max(240).optional(),
  voiceEnabled: Joi.boolean().optional(),
  language: Joi.string().optional(),
  copilotPersona: Joi.string().valid('coach', 'recruiter', 'study-buddy').optional(),
  reminderChannels: Joi.object({
    inApp: Joi.boolean().optional(),
    email: Joi.boolean().optional(),
    push: Joi.boolean().optional(),
  }).optional(),
});

// Create Interview Prep Schema
export const createInterviewPrepSchema = Joi.object({
  jobDescription: Joi.string().required(),
  interviewDate: Joi.date().iso().min('now').required(),
  preferences: Joi.object({
    dailyStudyTime: Joi.number().min(10).max(240).optional(),
    learningStyle: Joi.string().valid(...Object.values(LearningStyle)).optional(),
  }).optional(),
});

// Update Interview Prep Schema
export const updateInterviewPrepSchema = Joi.object({
  jobDescription: Joi.string().optional(),
  interviewDate: Joi.date().iso().min('now').optional(),
  status: Joi.string().valid(...Object.values(PrepStatus)).optional(),
  preferences: Joi.object({
    dailyStudyTime: Joi.number().min(10).max(240).optional(),
    learningStyle: Joi.string().valid(...Object.values(LearningStyle)).optional(),
  }).optional(),
});

// Update Topic Mastery Level Schema
export const updateTopicMasterySchema = Joi.object({
  masteryLevel: Joi.number().min(0).max(100).required(),
});

// Create Flashcard Schema
export const createFlashcardSchema = Joi.object({
  topicId: Joi.string().hex().length(24).required(),
  front: Joi.string().required(),
  back: Joi.string().required(),
});

// Update Flashcard Schema
export const updateFlashcardSchema = Joi.object({
  front: Joi.string().optional(),
  back: Joi.string().optional(),
});

// Flashcard Review Schema
export const reviewFlashcardSchema = Joi.object({
  rating: Joi.string().valid('again', 'hard', 'good', 'easy').required(),
  timeSpent: Joi.number().min(0).optional(),
});

// Log Activity Schema
export const logActivitySchema = Joi.object({
  prepId: Joi.string().hex().length(24).required(),
  activityType: Joi.string().valid(...Object.values(ActivityType)).required(),
  duration: Joi.number().min(0).optional(),
  metadata: Joi.object().optional(),
});

