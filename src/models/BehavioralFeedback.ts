import { Schema, model, Document, Types } from 'mongoose';

export interface IVideoMetrics {
  eyeContactScore: number; // 0-100
  fillerWordsCount: number;
  averagePauseDuration: number; // milliseconds
  speakingPace: number; // words per minute
  confidenceScore: number; // 0-100
  emotionTimeline: Array<{
    timestamp: number; // seconds from start
    emotion: 'confident' | 'uncertain' | 'stressed' | 'calm' | 'confused';
    confidenceLevel: number; // 0-100
  }>;
}

export interface ISTARAnalysis {
  situation: {
    score: number; // 0-100
    feedback: string;
    strength?: string;
    improvement?: string;
  };
  task: {
    score: number;
    feedback: string;
    strength?: string;
    improvement?: string;
  };
  action: {
    score: number;
    feedback: string;
    strength?: string;
    improvement?: string;
  };
  result: {
    score: number;
    feedback: string;
    strength?: string;
    improvement?: string;
  };
  overallSTARScore: number; // Average of all four
}

export interface IRecommendation {
  category: 'eye-contact' | 'filler-words' | 'pacing' | 'structure' | 'confidence' | 'technical-depth' | 'clarity';
  priority: number; // 1-5, 5 being highest
  suggestion: string;
  practiceExercise: string;
  expectedImprovement: string;
  resourceLink?: string;
}

export interface IBehavioralFeedback extends Document {
  userId: Types.ObjectId;
  mockInterviewId: Types.ObjectId;
  
  // Video analysis
  videoMetrics: IVideoMetrics;
  
  // STAR framework analysis
  starAnalysis: ISTARAnalysis;
  
  // Recommendations
  recommendations: IRecommendation[];
  
  // Overall scores
  overallCommunicationScore: number; // 0-100
  overallBehavioralScore: number; // 0-100 (weighted average)
  
  // Summary
  keyStrengths: string[];
  areasForImprovement: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

const VideoMetricsSchema = new Schema<IVideoMetrics>({
  eyeContactScore: { type: Number, min: 0, max: 100, required: true },
  fillerWordsCount: { type: Number, default: 0 },
  averagePauseDuration: { type: Number, default: 0 },
  speakingPace: { type: Number, default: 0 },
  confidenceScore: { type: Number, min: 0, max: 100, required: true },
  emotionTimeline: [
    {
      timestamp: { type: Number, required: true },
      emotion: { 
        type: String, 
        enum: ['confident', 'uncertain', 'stressed', 'calm', 'confused'],
        required: true 
      },
      confidenceLevel: { type: Number, min: 0, max: 100, required: true },
    },
  ],
});

const STARAnalysisSchema = new Schema<ISTARAnalysis>({
  situation: {
    score: { type: Number, min: 0, max: 100, required: true },
    feedback: { type: String, required: true },
    strength: { type: String },
    improvement: { type: String },
  },
  task: {
    score: { type: Number, min: 0, max: 100, required: true },
    feedback: { type: String, required: true },
    strength: { type: String },
    improvement: { type: String },
  },
  action: {
    score: { type: Number, min: 0, max: 100, required: true },
    feedback: { type: String, required: true },
    strength: { type: String },
    improvement: { type: String },
  },
  result: {
    score: { type: Number, min: 0, max: 100, required: true },
    feedback: { type: String, required: true },
    strength: { type: String },
    improvement: { type: String },
  },
  overallSTARScore: { type: Number, min: 0, max: 100, required: true },
});

const RecommendationSchema = new Schema<IRecommendation>({
  category: {
    type: String,
    enum: ['eye-contact', 'filler-words', 'pacing', 'structure', 'confidence', 'technical-depth', 'clarity'],
    required: true,
  },
  priority: { type: Number, min: 1, max: 5, required: true },
  suggestion: { type: String, required: true },
  practiceExercise: { type: String, required: true },
  expectedImprovement: { type: String, required: true },
  resourceLink: { type: String },
});

const BehavioralFeedbackSchema = new Schema<IBehavioralFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mockInterviewId: { type: Schema.Types.ObjectId, ref: 'MockInterview', required: true, index: true, unique: true },
    
    videoMetrics: VideoMetricsSchema,
    starAnalysis: STARAnalysisSchema,
    
    recommendations: [RecommendationSchema],
    
    overallCommunicationScore: { type: Number, min: 0, max: 100, required: true },
    overallBehavioralScore: { type: Number, min: 0, max: 100, required: true },
    
    keyStrengths: [{ type: String }],
    areasForImprovement: [{ type: String }],
    
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
BehavioralFeedbackSchema.index({ userId: 1, createdAt: -1 });
BehavioralFeedbackSchema.index({ overallBehavioralScore: -1, createdAt: -1 }); // For progress tracking

export default model<IBehavioralFeedback>('BehavioralFeedback', BehavioralFeedbackSchema);
