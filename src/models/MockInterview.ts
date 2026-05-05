import { Schema, model, Document, Types } from 'mongoose';

export enum InterviewType {
  TECHNICAL = 'technical',
  BEHAVIORAL = 'behavioral',
  SYSTEM_DESIGN = 'system-design',
  MIXED = 'mixed'
}

export enum InterviewDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

export enum InterviewStatus {
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned'
}

export interface IQuestionResponse {
  questionId: string;
  question: string;
  askedAt: Date;
  userResponse: string;
  responseAudioUrl?: string; // S3 URL
  responseVideoUrl?: string; // S3 URL
  responseDuration: number; // seconds
  transcript: string; // From speech-to-text
  aiAnalysis: {
    clarity: number; // 0-100
    completeness: number; // 0-100
    technicalAccuracy: number; // 0-100
    communicationSkill: number; // 0-100
    relevance: number; // 0-100
    feedback: string;
    suggestedImprovement: string;
  };
  timestamp: Date;
}

export interface IMockInterview extends Document {
  userId: Types.ObjectId;
  prepId: Types.ObjectId;
  
  // Interview metadata
  interviewType: InterviewType;
  difficulty: InterviewDifficulty;
  duration: number; // minutes
  
  // Interview content
  questions: IQuestionResponse[];
  
  // Overall metrics
  overallScore: number; // 0-100
  videoRecordingUrl?: string; // S3 URL - full interview recording
  fullTranscript: string; // Complete transcript
  
  // Status tracking
  status: InterviewStatus;
  startedAt: Date;
  completedAt?: Date;
  
  // Summary
  summary: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  
  // Metadata for trending
  completionPercentage: number; // % of questions answered
  averageResponseTime: number; // seconds
  
  createdAt: Date;
  updatedAt: Date;
}

const QuestionResponseSchema = new Schema<IQuestionResponse>({
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

const MockInterviewSchema = new Schema<IMockInterview>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prepId: { type: Schema.Types.ObjectId, ref: 'InterviewPrep', required: true, index: true },
    
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
  },
  { timestamps: true }
);

// Indexes for performance
MockInterviewSchema.index({ userId: 1, createdAt: -1 });
MockInterviewSchema.index({ prepId: 1, status: 1 });
MockInterviewSchema.index({ overallScore: -1, createdAt: -1 }); // For leaderboards

export default model<IMockInterview>('MockInterview', MockInterviewSchema);
