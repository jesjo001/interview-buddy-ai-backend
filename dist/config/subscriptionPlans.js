"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEffectivePlan = exports.PLAN_ENTITLEMENTS = void 0;
const types_1 = require("../types");
exports.PLAN_ENTITLEMENTS = {
    [types_1.SubscriptionPlan.FREE]: {
        interviewPrepCreate: 1,
        mockInterviewStart: 0,
        voiceMinutes: 0,
        chatbotMessage: 20,
    },
    [types_1.SubscriptionPlan.PRO]: {
        interviewPrepCreate: 8,
        mockInterviewStart: 20,
        voiceMinutes: 300,
        chatbotMessage: 1000,
    },
    [types_1.SubscriptionPlan.ENTERPRISE]: {
        interviewPrepCreate: null,
        mockInterviewStart: null,
        voiceMinutes: 3000,
        chatbotMessage: null,
    },
};
const resolveEffectivePlan = (subscription) => {
    const now = Date.now();
    const hasAccessByDate = !subscription.validUntil || subscription.validUntil.getTime() >= now;
    const hasActiveStatus = subscription.status === types_1.SubscriptionStatus.ACTIVE || subscription.status === types_1.SubscriptionStatus.CANCELED;
    if (hasActiveStatus && hasAccessByDate) {
        return subscription.plan;
    }
    return types_1.SubscriptionPlan.FREE;
};
exports.resolveEffectivePlan = resolveEffectivePlan;
