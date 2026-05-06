import { Types } from 'mongoose';
import ChatbotReminder, { IChatbotReminder, ReminderPriority } from '../models/ChatbotReminder';
import InterviewPrep from '../models/InterviewPrep';
import User from '../models/User';
import { sendEmail } from './emailService';

export interface CreateReminderInput {
  userId: Types.ObjectId;
  prepId: string;
  title: string;
  message: string;
  priority: ReminderPriority;
  scheduledFor: Date;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
}

export const createReminder = async (input: CreateReminderInput) => {
  const prep = await InterviewPrep.findOne({ _id: input.prepId, userId: input.userId });
  if (!prep) return null;

  const reminder = await ChatbotReminder.create({
    userId: input.userId,
    prepId: prep._id,
    title: input.title,
    message: input.message,
    priority: input.priority,
    scheduledFor: input.scheduledFor,
    channels: input.channels,
    status: 'scheduled',
    delivery: {
      inAppAvailableAt: input.channels.inApp ? input.scheduledFor : undefined,
    },
  });

  return reminder;
};

export const listReminderFeed = async (
  userId: Types.ObjectId,
  prepId?: string,
  includeDismissed = false
) => {
  const query: {
    userId: Types.ObjectId;
    prepId?: Types.ObjectId;
    status?: { $ne: 'dismissed' };
  } = { userId };

  if (prepId && Types.ObjectId.isValid(prepId)) {
    query.prepId = new Types.ObjectId(prepId);
  }

  if (!includeDismissed) {
    query.status = { $ne: 'dismissed' };
  }

  return ChatbotReminder.find(query).sort({ scheduledFor: 1, createdAt: -1 }).limit(60);
};

export const dismissReminder = async (userId: Types.ObjectId, reminderId: string) => {
  if (!Types.ObjectId.isValid(reminderId)) return null;

  return ChatbotReminder.findOneAndUpdate(
    { _id: reminderId, userId },
    { status: 'dismissed', dismissedAt: new Date() },
    { new: true }
  );
};

export const dispatchReminder = async (reminder: IChatbotReminder) => {
  try {
    if (reminder.status === 'dismissed') return reminder;

    const user = await User.findById(reminder.userId);
    if (!user) throw new Error('User not found for reminder dispatch');

    const now = new Date();

    if (reminder.channels.email) {
      await sendEmail({
        to: user.email,
        subject: reminder.title,
        html: `<p>${reminder.message}</p>`,
        text: reminder.message,
      });
      reminder.delivery.emailSentAt = now;
    }

    if (reminder.channels.push) {
      // Push transport is not configured in this backend yet.
      reminder.delivery.pushAttemptedAt = now;
    }

    reminder.deliveredAt = now;
    reminder.status = 'sent';
    await reminder.save();
    return reminder;
  } catch (error: any) {
    reminder.status = 'failed';
    reminder.delivery.lastError = error?.message || 'Dispatch failure';
    await reminder.save();
    return reminder;
  }
};

export const dispatchReminderById = async (reminderId: string) => {
  if (!Types.ObjectId.isValid(reminderId)) return null;
  const reminder = await ChatbotReminder.findById(reminderId);
  if (!reminder) return null;
  return dispatchReminder(reminder);
};
