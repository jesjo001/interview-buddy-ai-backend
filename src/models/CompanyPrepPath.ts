import { Schema, model, Document, Types } from 'mongoose';
import { InterviewRound, UserLevel } from './CompanyProfile';

export enum RoundStatus {
  NOT_STARTED = 'not-started',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed'
}

export interface IRoundProgress {
  round: InterviewRound;
  status: RoundStatus;
  completedMockInterviews: number;
  averageScore: number; // 0-100
  lastPracticed?: Date;
  targetScore: number; // 0-100
  notes?: string;
}

export interface ICompanyPrepPath extends Document {
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  prepId: Types.ObjectId;
  
  targetRole: string;
  targetLevel: UserLevel;
  
  progressByRound: IRoundProgress[];
  
  completionPercentage: number; // 0-100
  estimatedReadiness: number; // 0-100
  
  startedAt: Date;
  targetCompletionDate?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const RoundProgressSchema = new Schema<IRoundProgress>({
  round: { 
    type: String, 
    enum: Object.values(InterviewRound),
    required: true 
  },
  status: { 
    type: String, 
    enum: Object.values(RoundStatus),
    default: RoundStatus.NOT_STARTED,
    required: true 
  },
  completedMockInterviews: { type: Number, default: 0 },
  averageScore: { type: Number, min: 0, max: 100, default: 0 },
  lastPracticed: { type: Date },
  targetScore: { type: Number, min: 0, max: 100, default: 80 },
  notes: { type: String },
});

const CompanyPrepPathSchema = new Schema<ICompanyPrepPath>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'CompanyProfile', required: true, index: true },
    prepId: { type: Schema.Types.ObjectId, ref: 'InterviewPrep', required: true, index: true },
    
    targetRole: { type: String, required: true },
    targetLevel: { 
      type: String, 
      enum: Object.values(UserLevel),
      required: true 
    },
    
    progressByRound: [RoundProgressSchema],
    
    completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
    estimatedReadiness: { type: Number, min: 0, max: 100, default: 0 },
    
    startedAt: { type: Date, default: Date.now },
    targetCompletionDate: { type: Date },
    
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
CompanyPrepPathSchema.index({ userId: 1, prepId: 1 });
CompanyPrepPathSchema.index({ companyId: 1, targetRole: 1 });

export default model<ICompanyPrepPath>('CompanyPrepPath', CompanyPrepPathSchema);
