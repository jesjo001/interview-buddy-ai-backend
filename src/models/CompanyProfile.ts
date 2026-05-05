import { Schema, model, Document, Types } from 'mongoose';

export enum InterviewRound {
  PHONE_SCREEN = 'phone-screen',
  CODING = 'coding',
  SYSTEM_DESIGN = 'system-design',
  BEHAVIORAL = 'behavioral',
  ONSITE = 'onsite',
  EXECUTIVE = 'executive'
}

export enum UserLevel {
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  STAFF = 'staff'
}

export enum InterviewOutcome {
  OFFER = 'offer',
  REJECTED = 'rejected',
  CONTINUING = 'continuing'
}

export interface IRoundDetail {
  round: InterviewRound;
  duration: number; // minutes
  focus: string; // e.g., "Algorithm fundamentals", "System design at scale"
  tips: string[];
  averageTimeToAnswer?: number; // seconds
  successRate?: number; // 0-100
}

export interface IRoleBreakdown {
  requiredSkills: string[];
  commonSkills: string[];
  averagePrepTime: number; // hours
  typicalRoundsCount: number;
  roundDetails: IRoundDetail[];
  estimatedSalary: {
    junior?: { min: number; max: number };
    mid?: { min: number; max: number };
    senior?: { min: number; max: number };
    staff?: { min: number; max: number };
  };
}

export interface IRealInterviewData {
  userId: Types.ObjectId;
  role: string;
  round: InterviewRound;
  questions: string[]; // Real questions user got asked
  outcome: InterviewOutcome;
  tips: string;
  rating: number; // 1-5
  timestamp: Date;
}

export interface ICompanyProfile extends Document {
  company: string;
  website?: string;
  industry?: string;
  
  // Company culture
  culturalAttributes: {
    leadershipPrinciples?: string[];
    values: string[];
    interviewStyle: string; // Description of their interview process
    cultureFit: string; // What they look for culturally
  };
  
  // Role-specific information
  byRole: Map<string, IRoleBreakdown>; // Key: role title (e.g., "Software Engineer", "Product Manager")
  
  // Real interview experiences (crowdsourced)
  realInterviews: IRealInterviewData[];
  
  // Metrics
  averageRating: number; // 0-5 from real users
  totalReviews: number;
  
  // Search metadata
  tags: string[]; // e.g., ["FAANG", "startup", "AI", "fintech"]
  
  createdAt: Date;
  updatedAt: Date;
}

const RoundDetailSchema = new Schema<IRoundDetail>({
  round: { 
    type: String, 
    enum: Object.values(InterviewRound),
    required: true 
  },
  duration: { type: Number, required: true },
  focus: { type: String, required: true },
  tips: [{ type: String }],
  averageTimeToAnswer: { type: Number },
  successRate: { type: Number, min: 0, max: 100 },
});

const RoleBreakdownSchema = new Schema<IRoleBreakdown>({
  requiredSkills: [{ type: String }],
  commonSkills: [{ type: String }],
  averagePrepTime: { type: Number, required: true },
  typicalRoundsCount: { type: Number, required: true },
  roundDetails: [RoundDetailSchema],
  estimatedSalary: {
    junior: { min: { type: Number }, max: { type: Number } },
    mid: { min: { type: Number }, max: { type: Number } },
    senior: { min: { type: Number }, max: { type: Number } },
    staff: { min: { type: Number }, max: { type: Number } },
  },
});

const RealInterviewSchema = new Schema<IRealInterviewData>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true },
  round: { 
    type: String, 
    enum: Object.values(InterviewRound),
    required: true 
  },
  questions: [{ type: String }],
  outcome: { 
    type: String, 
    enum: Object.values(InterviewOutcome),
    required: true 
  },
  tips: { type: String },
  rating: { type: Number, min: 1, max: 5, required: true },
  timestamp: { type: Date, default: Date.now },
});

const CompanyProfileSchema = new Schema<ICompanyProfile>(
  {
    company: { type: String, required: true, unique: true, lowercase: true, index: true },
    website: { type: String },
    industry: { type: String, index: true },
    
    culturalAttributes: {
      leadershipPrinciples: [{ type: String }],
      values: [{ type: String }],
      interviewStyle: { type: String, default: '' },
      cultureFit: { type: String, default: '' },
    },
    
    byRole: {
      type: Map,
      of: RoleBreakdownSchema,
      default: new Map(),
    },
    
    realInterviews: [RealInterviewSchema],
    
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    totalReviews: { type: Number, default: 0 },
    
    tags: [{ type: String, lowercase: true, index: true }],
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes for search and filtering
CompanyProfileSchema.index({ company: 'text', tags: 1 });
CompanyProfileSchema.index({ averageRating: -1, totalReviews: -1 });

export default model<ICompanyProfile>('CompanyProfile', CompanyProfileSchema);
