import { Schema, model, Document, Types } from 'mongoose';

export interface IUserReadinessTimeline extends Document {
  userId: Types.ObjectId;
  prepId: Types.ObjectId;
  
  readinessScore: number; // 0-100
  confidence: number; // 0-100 - confidence interval
  
  metrics: {
    mockInterviewScore: number;
    flashcardAccuracy: number;
    topicsCompleted: number;
    topicsTotal: number;
    daysRemaining: number;
    hoursInvested: number;
    consistencyStreak: number; // days
  };
  
  recommendation: string;
  focusAreas: string[];
  
  predictedOutcome: {
    passLikelihood: number; // 0-100
    estimatedScore: number; // 0-100
    timeNeededToImprove: number; // hours
  };
  
  snapshot_date: Date; // Daily snapshot
  
  createdAt: Date;
}

const UserReadinessTimelineSchema = new Schema<IUserReadinessTimeline>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prepId: { type: Schema.Types.ObjectId, ref: 'InterviewPrep', required: true, index: true },
    
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
  },
  { timestamps: false }
);

// Indexes for trending analysis
UserReadinessTimelineSchema.index({ userId: 1, prepId: 1, snapshot_date: -1 });
UserReadinessTimelineSchema.index({ prepId: 1, snapshot_date: -1 });

export default model<IUserReadinessTimeline>('UserReadinessTimeline', UserReadinessTimelineSchema);
