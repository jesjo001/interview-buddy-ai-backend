import { Schema, model, Document } from 'mongoose';
import { SubscriptionPlan, SubscriptionStatus, LearningStyle } from '../types';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  avatar?: string;
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    validUntil?: Date;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
  preferences: {
    learningStyle: LearningStyle;
    dailyStudyTime: number; // minutes
    voiceEnabled: boolean;
    language: string;
  };
  refreshTokens: string[];
  emailVerified: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  avatar: { type: String, default: '' },
  subscription: {
    plan: { type: String, enum: Object.values(SubscriptionPlan), default: SubscriptionPlan.FREE },
    status: { type: String, enum: Object.values(SubscriptionStatus), default: SubscriptionStatus.ACTIVE },
    validUntil: { type: Date },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String }
  },
  preferences: {
    learningStyle: { type: String, enum: Object.values(LearningStyle), default: LearningStyle.VISUAL },
    dailyStudyTime: { type: Number, default: 60 },
    voiceEnabled: { type: Boolean, default: true },
    language: { type: String, default: 'en' }
  },
  refreshTokens: [{ type: String }],
  emailVerified: { type: Boolean, default: false },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default model<IUser>('User', UserSchema);
