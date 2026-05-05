import { Schema, model, Document, Types } from 'mongoose';
import { AnalysisStatus, JobParsedData, PrepStatus, TopicDifficulty } from '../types';

export interface IDailyScheduleTopic {
  topicId: Types.ObjectId; // Refers to the Topic model
  estimatedTime: number; // minutes
  completed: boolean;
  completedAt?: Date;
}

export interface IDailySchedule {
  day: number;
  date: Date;
  topics: IDailyScheduleTopic[];
}

export interface IInterviewPrep extends Document {
  userId: Types.ObjectId;
  jobDescription: {
    rawText: string;
    fileUrl?: string; // S3/Cloudinary URL if uploaded
    parsedData?: JobParsedData;
  };
  interviewDate: Date;
  studyPlan: {
    startDate: Date;
    totalDays: number;
    dailySchedule: IDailySchedule[];
  };
  progress: {
    overallPercentage: number;
    topicsCompleted: number;
    totalTopics: number;
    flashcardsReviewed: number;
    totalFlashcards: number;
    timeSpent: number; // minutes
  };
  status: PrepStatus;
  analysisStatus: AnalysisStatus;
  createdAt: Date;
  updatedAt: Date;
}

const InterviewPrepSchema = new Schema<IInterviewPrep>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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
            topicId: { type: Schema.Types.ObjectId, ref: 'Topic' },
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
  status: { type: String, enum: Object.values(PrepStatus), default: PrepStatus.ACTIVE },
  analysisStatus: { type: String, enum: Object.values(AnalysisStatus), default: AnalysisStatus.PENDING },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes to speed up common queries
InterviewPrepSchema.index({ userId: 1, interviewDate: 1 });
InterviewPrepSchema.index({ 'jobDescription.parsedData.jobTitle': 1 });

export default model<IInterviewPrep>('InterviewPrep', InterviewPrepSchema);
