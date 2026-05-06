import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import Joi from 'joi';
import {
  buildReminderSuggestions,
  ChatbotPersona,
  generateChatbotReply,
  getContextSnapshot,
} from '../services/chatbotService';
import { checkFeatureQuota, consumeFeatureQuota } from '../services/quotaService';
import {
  createReminder,
  dispatchReminderById,
  dismissReminder,
  listReminderFeed,
} from '../services/reminderService';
import { jobQueueService } from '../services/queueService';

const messageSchema = Joi.object({
  prepId: Joi.string().hex().length(24).optional(),
  message: Joi.string().trim().min(1).max(3000).required(),
  persona: Joi.string().valid('coach', 'recruiter', 'study-buddy').optional(),
});

const createReminderSchema = Joi.object({
  prepId: Joi.string().hex().length(24).required(),
  title: Joi.string().trim().min(1).max(160).required(),
  message: Joi.string().trim().min(1).max(1200).required(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  scheduledFor: Joi.date().iso().required(),
  channels: Joi.object({
    inApp: Joi.boolean().default(true),
    email: Joi.boolean().default(true),
    push: Joi.boolean().default(false),
  })
    .default({ inApp: true, email: true, push: false })
    .required(),
});

const updateCopilotPreferencesSchema = Joi.object({
  copilotPersona: Joi.string().valid('coach', 'recruiter', 'study-buddy').optional(),
  reminderChannels: Joi.object({
    inApp: Joi.boolean().optional(),
    email: Joi.boolean().optional(),
    push: Joi.boolean().optional(),
  }).optional(),
});

export const getPersonas = async (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    personas: [
      { id: 'coach', label: 'Coach' },
      { id: 'recruiter', label: 'Recruiter' },
      { id: 'study-buddy', label: 'Study Buddy' },
    ],
  });
};

export const getCopilotPreferences = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  return res.status(200).json({
    success: true,
    preferences: {
      copilotPersona: req.user.preferences?.copilotPersona || 'coach',
      reminderChannels: req.user.preferences?.reminderChannels || {
        inApp: true,
        email: true,
        push: false,
      },
    },
  });
};

export const updateCopilotPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { error, value } = updateCopilotPreferencesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    if (value.copilotPersona) {
      req.user.preferences.copilotPersona = value.copilotPersona;
    }

    if (value.reminderChannels) {
      req.user.preferences.reminderChannels = {
        ...req.user.preferences.reminderChannels,
        ...value.reminderChannels,
      };
    }

    await req.user.save();

    return res.status(200).json({
      success: true,
      preferences: {
        copilotPersona: req.user.preferences.copilotPersona,
        reminderChannels: req.user.preferences.reminderChannels,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getChatbotContext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { prepId } = req.params;
    if (!Types.ObjectId.isValid(prepId)) {
      return res.status(400).json({ error: 'Invalid prep ID' });
    }

    const context = await getContextSnapshot(req.user._id, prepId);
    if (!context) {
      return res.status(404).json({ error: 'Preparation context not found' });
    }

    return res.status(200).json({ success: true, context });
  } catch (error) {
    return next(error);
  }
};

export const previewReminders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { prepId } = req.params;
    if (!Types.ObjectId.isValid(prepId)) {
      return res.status(400).json({ error: 'Invalid prep ID' });
    }

    const context = await getContextSnapshot(req.user._id, prepId);
    if (!context) {
      return res.status(404).json({ error: 'Preparation context not found' });
    }

    const reminders = buildReminderSuggestions(context);
    return res.status(200).json({ success: true, reminders, context });
  } catch (error) {
    return next(error);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const quota = await checkFeatureQuota(req.user as any, 'chatbotMessage', 1);
    if (!quota.allowed) {
      return res.status(403).json({
        error: 'Chatbot message quota exceeded for your current plan',
        code: 'quota_exceeded',
        feature: quota.feature,
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
        plan: quota.plan,
      });
    }

    const { error, value } = messageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const persona = value.persona as ChatbotPersona;
    const prepId = value.prepId as string | undefined;
    const message = value.message as string;
    const effectivePersona = (persona || req.user.preferences?.copilotPersona || 'coach') as ChatbotPersona;

    const context = prepId ? await getContextSnapshot(req.user._id, prepId) : null;
    if (prepId && !context) {
      return res.status(404).json({ error: 'Preparation context not found' });
    }

    const reply = await generateChatbotReply({ message, persona: effectivePersona, context });
    await consumeFeatureQuota(req.user._id as any, 'chatbotMessage', 1);
    const reminders = context ? buildReminderSuggestions(context) : [];

    return res.status(200).json({
      success: true,
      persona: effectivePersona,
      reply,
      context,
      reminders,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
};

export const createScheduledReminder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { error, value } = createReminderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const scheduledFor = new Date(value.scheduledFor);
    const reminder = await createReminder({
      userId: req.user._id,
      prepId: value.prepId,
      title: value.title,
      message: value.message,
      priority: value.priority,
      scheduledFor,
      channels: value.channels,
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Preparation context not found' });
    }

    const delayMs = Math.max(0, scheduledFor.getTime() - Date.now());
    jobQueueService.add(
      'send-reminder',
      {
        prepId: reminder.prepId,
        userId: reminder.userId,
        reminderId: reminder._id.toString(),
      },
      3,
      delayMs
    );

    return res.status(201).json({ success: true, reminder });
  } catch (error) {
    return next(error);
  }
};

export const getReminderFeed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const prepId = typeof req.query.prepId === 'string' ? req.query.prepId : undefined;
    const includeDismissed = req.query.includeDismissed === 'true';
    const reminders = await listReminderFeed(req.user._id, prepId, includeDismissed);

    return res.status(200).json({ success: true, reminders });
  } catch (error) {
    return next(error);
  }
};

export const dismissReminderItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { reminderId } = req.params;
    const reminder = await dismissReminder(req.user._id, reminderId);
    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    return res.status(200).json({ success: true, reminder });
  } catch (error) {
    return next(error);
  }
};

export const sendReminderNow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { reminderId } = req.params;
    const reminder = await dispatchReminderById(reminderId);
    if (!reminder || reminder.userId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    return res.status(200).json({ success: true, reminder });
  } catch (error) {
    return next(error);
  }
};
