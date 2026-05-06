"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchReminderById = exports.dispatchReminder = exports.dismissReminder = exports.listReminderFeed = exports.createReminder = void 0;
const mongoose_1 = require("mongoose");
const ChatbotReminder_1 = __importDefault(require("../models/ChatbotReminder"));
const InterviewPrep_1 = __importDefault(require("../models/InterviewPrep"));
const User_1 = __importDefault(require("../models/User"));
const emailService_1 = require("./emailService");
const createReminder = async (input) => {
    const prep = await InterviewPrep_1.default.findOne({ _id: input.prepId, userId: input.userId });
    if (!prep)
        return null;
    const reminder = await ChatbotReminder_1.default.create({
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
exports.createReminder = createReminder;
const listReminderFeed = async (userId, prepId, includeDismissed = false) => {
    const query = { userId };
    if (prepId && mongoose_1.Types.ObjectId.isValid(prepId)) {
        query.prepId = new mongoose_1.Types.ObjectId(prepId);
    }
    if (!includeDismissed) {
        query.status = { $ne: 'dismissed' };
    }
    return ChatbotReminder_1.default.find(query).sort({ scheduledFor: 1, createdAt: -1 }).limit(60);
};
exports.listReminderFeed = listReminderFeed;
const dismissReminder = async (userId, reminderId) => {
    if (!mongoose_1.Types.ObjectId.isValid(reminderId))
        return null;
    return ChatbotReminder_1.default.findOneAndUpdate({ _id: reminderId, userId }, { status: 'dismissed', dismissedAt: new Date() }, { new: true });
};
exports.dismissReminder = dismissReminder;
const dispatchReminder = async (reminder) => {
    try {
        if (reminder.status === 'dismissed')
            return reminder;
        const user = await User_1.default.findById(reminder.userId);
        if (!user)
            throw new Error('User not found for reminder dispatch');
        const now = new Date();
        if (reminder.channels.email) {
            await (0, emailService_1.sendEmail)({
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
    }
    catch (error) {
        reminder.status = 'failed';
        reminder.delivery.lastError = error?.message || 'Dispatch failure';
        await reminder.save();
        return reminder;
    }
};
exports.dispatchReminder = dispatchReminder;
const dispatchReminderById = async (reminderId) => {
    if (!mongoose_1.Types.ObjectId.isValid(reminderId))
        return null;
    const reminder = await ChatbotReminder_1.default.findById(reminderId);
    if (!reminder)
        return null;
    return (0, exports.dispatchReminder)(reminder);
};
exports.dispatchReminderById = dispatchReminderById;
