import { Schema, model, Document, Types } from 'mongoose';
import { ActivityType } from '../types';

export interface IActivity {
  type: ActivityType;
  timestamp: Date;
  duration?: number; // minutes
  metadata?: Types.Map<any>; // Flexible for different activity types
}

export interface IUserProgress extends Document {
  userId: Types.ObjectId;
  interviewPrepId: Types.ObjectId;
  date: Date;
  activities: IActivity[];
  dailyGoalMet: boolean;
  streakCount: number;
  createdAt: Date;
}

const UserProgressSchema = new Schema<IUserProgress>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  interviewPrepId: { type: Schema.Types.ObjectId, ref: 'InterviewPrep', required: true },
  date: { type: Date, required: true },
  activities: [
    {
      type: { type: String, enum: Object.values(ActivityType), required: true },
      timestamp: { type: Date, default: Date.now },
      duration: { type: Number },
      metadata: { type: Schema.Types.Mixed }, // Use Mixed for flexible metadata
    },
  ],
  dailyGoalMet: { type: Boolean, default: false },
  streakCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default model<IUserProgress>('UserProgress', UserProgressSchema);
