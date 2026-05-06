import { Document, Schema, Types, model } from 'mongoose';

export type ReminderPriority = 'low' | 'medium' | 'high';
export type ReminderStatus = 'scheduled' | 'sent' | 'dismissed' | 'failed';

export interface IChatbotReminder extends Document {
  userId: Types.ObjectId;
  prepId: Types.ObjectId;
  title: string;
  message: string;
  priority: ReminderPriority;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  scheduledFor: Date;
  status: ReminderStatus;
  deliveredAt?: Date;
  dismissedAt?: Date;
  delivery: {
    emailSentAt?: Date;
    pushAttemptedAt?: Date;
    inAppAvailableAt?: Date;
    lastError?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ChatbotReminderSchema = new Schema<IChatbotReminder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prepId: { type: Schema.Types.ObjectId, ref: 'InterviewPrep', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 1200 },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      required: true,
    },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
    },
    scheduledFor: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['scheduled', 'sent', 'dismissed', 'failed'],
      default: 'scheduled',
      required: true,
      index: true,
    },
    deliveredAt: { type: Date },
    dismissedAt: { type: Date },
    delivery: {
      emailSentAt: { type: Date },
      pushAttemptedAt: { type: Date },
      inAppAvailableAt: { type: Date },
      lastError: { type: String },
    },
  },
  { timestamps: true }
);

ChatbotReminderSchema.index({ userId: 1, status: 1, scheduledFor: 1 });
ChatbotReminderSchema.index({ prepId: 1, scheduledFor: -1 });

export default model<IChatbotReminder>('ChatbotReminder', ChatbotReminderSchema);
