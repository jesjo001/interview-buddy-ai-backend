import { Document, Schema, Types, model } from 'mongoose';

export interface IUserQuota extends Document {
  userId: Types.ObjectId;
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
  usage: {
    interviewPrepCreate: number;
    mockInterviewStart: number;
    voiceMinutes: number;
    chatbotMessage: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserQuotaSchema = new Schema<IUserQuota>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    periodKey: { type: String, required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    usage: {
      interviewPrepCreate: { type: Number, default: 0, min: 0 },
      mockInterviewStart: { type: Number, default: 0, min: 0 },
      voiceMinutes: { type: Number, default: 0, min: 0 },
      chatbotMessage: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true }
);

UserQuotaSchema.index({ userId: 1, periodKey: 1 }, { unique: true });

export default model<IUserQuota>('UserQuota', UserQuotaSchema);
