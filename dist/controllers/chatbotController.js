"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendReminderNow = exports.dismissReminderItem = exports.getReminderFeed = exports.createScheduledReminder = exports.sendMessage = exports.previewReminders = exports.getChatbotContext = exports.updateCopilotPreferences = exports.getCopilotPreferences = exports.getPersonas = void 0;
const mongoose_1 = require("mongoose");
const joi_1 = __importDefault(require("joi"));
const chatbotService_1 = require("../services/chatbotService");
const reminderService_1 = require("../services/reminderService");
const queueService_1 = require("../services/queueService");
const messageSchema = joi_1.default.object({
    prepId: joi_1.default.string().hex().length(24).optional(),
    message: joi_1.default.string().trim().min(1).max(3000).required(),
    persona: joi_1.default.string().valid('coach', 'recruiter', 'study-buddy').optional(),
});
const createReminderSchema = joi_1.default.object({
    prepId: joi_1.default.string().hex().length(24).required(),
    title: joi_1.default.string().trim().min(1).max(160).required(),
    message: joi_1.default.string().trim().min(1).max(1200).required(),
    priority: joi_1.default.string().valid('low', 'medium', 'high').default('medium'),
    scheduledFor: joi_1.default.date().iso().required(),
    channels: joi_1.default.object({
        inApp: joi_1.default.boolean().default(true),
        email: joi_1.default.boolean().default(true),
        push: joi_1.default.boolean().default(false),
    })
        .default({ inApp: true, email: true, push: false })
        .required(),
});
const updateCopilotPreferencesSchema = joi_1.default.object({
    copilotPersona: joi_1.default.string().valid('coach', 'recruiter', 'study-buddy').optional(),
    reminderChannels: joi_1.default.object({
        inApp: joi_1.default.boolean().optional(),
        email: joi_1.default.boolean().optional(),
        push: joi_1.default.boolean().optional(),
    }).optional(),
});
const getPersonas = async (_req, res) => {
    return res.status(200).json({
        success: true,
        personas: [
            { id: 'coach', label: 'Coach' },
            { id: 'recruiter', label: 'Recruiter' },
            { id: 'study-buddy', label: 'Study Buddy' },
        ],
    });
};
exports.getPersonas = getPersonas;
const getCopilotPreferences = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ error: 'Unauthorized' });
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
exports.getCopilotPreferences = getCopilotPreferences;
const updateCopilotPreferences = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
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
    }
    catch (error) {
        return next(error);
    }
};
exports.updateCopilotPreferences = updateCopilotPreferences;
const getChatbotContext = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { prepId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(prepId)) {
            return res.status(400).json({ error: 'Invalid prep ID' });
        }
        const context = await (0, chatbotService_1.getContextSnapshot)(req.user._id, prepId);
        if (!context) {
            return res.status(404).json({ error: 'Preparation context not found' });
        }
        return res.status(200).json({ success: true, context });
    }
    catch (error) {
        return next(error);
    }
};
exports.getChatbotContext = getChatbotContext;
const previewReminders = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { prepId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(prepId)) {
            return res.status(400).json({ error: 'Invalid prep ID' });
        }
        const context = await (0, chatbotService_1.getContextSnapshot)(req.user._id, prepId);
        if (!context) {
            return res.status(404).json({ error: 'Preparation context not found' });
        }
        const reminders = (0, chatbotService_1.buildReminderSuggestions)(context);
        return res.status(200).json({ success: true, reminders, context });
    }
    catch (error) {
        return next(error);
    }
};
exports.previewReminders = previewReminders;
const sendMessage = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { error, value } = messageSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const persona = value.persona;
        const prepId = value.prepId;
        const message = value.message;
        const effectivePersona = (persona || req.user.preferences?.copilotPersona || 'coach');
        const context = prepId ? await (0, chatbotService_1.getContextSnapshot)(req.user._id, prepId) : null;
        if (prepId && !context) {
            return res.status(404).json({ error: 'Preparation context not found' });
        }
        const reply = await (0, chatbotService_1.generateChatbotReply)({ message, persona: effectivePersona, context });
        const reminders = context ? (0, chatbotService_1.buildReminderSuggestions)(context) : [];
        return res.status(200).json({
            success: true,
            persona: effectivePersona,
            reply,
            context,
            reminders,
            generatedAt: new Date().toISOString(),
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.sendMessage = sendMessage;
const createScheduledReminder = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { error, value } = createReminderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const scheduledFor = new Date(value.scheduledFor);
        const reminder = await (0, reminderService_1.createReminder)({
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
        queueService_1.jobQueueService.add('send-reminder', {
            prepId: reminder.prepId,
            userId: reminder.userId,
            reminderId: reminder._id.toString(),
        }, 3, delayMs);
        return res.status(201).json({ success: true, reminder });
    }
    catch (error) {
        return next(error);
    }
};
exports.createScheduledReminder = createScheduledReminder;
const getReminderFeed = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const prepId = typeof req.query.prepId === 'string' ? req.query.prepId : undefined;
        const includeDismissed = req.query.includeDismissed === 'true';
        const reminders = await (0, reminderService_1.listReminderFeed)(req.user._id, prepId, includeDismissed);
        return res.status(200).json({ success: true, reminders });
    }
    catch (error) {
        return next(error);
    }
};
exports.getReminderFeed = getReminderFeed;
const dismissReminderItem = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { reminderId } = req.params;
        const reminder = await (0, reminderService_1.dismissReminder)(req.user._id, reminderId);
        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found' });
        }
        return res.status(200).json({ success: true, reminder });
    }
    catch (error) {
        return next(error);
    }
};
exports.dismissReminderItem = dismissReminderItem;
const sendReminderNow = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { reminderId } = req.params;
        const reminder = await (0, reminderService_1.dispatchReminderById)(reminderId);
        if (!reminder || reminder.userId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ error: 'Reminder not found' });
        }
        return res.status(200).json({ success: true, reminder });
    }
    catch (error) {
        return next(error);
    }
};
exports.sendReminderNow = sendReminderNow;
