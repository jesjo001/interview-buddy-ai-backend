"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUsageSnapshot = exports.consumeFeatureQuota = exports.checkFeatureQuota = void 0;
const UserQuota_1 = __importDefault(require("../models/UserQuota"));
const subscriptionPlans_1 = require("../config/subscriptionPlans");
const toPeriodKey = (date) => {
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
};
const monthWindow = (date) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
    return { start, end };
};
const ensurePeriodDoc = async (userId, date) => {
    const periodKey = toPeriodKey(date);
    const { start, end } = monthWindow(date);
    const doc = await UserQuota_1.default.findOneAndUpdate({ userId, periodKey }, {
        $setOnInsert: {
            userId,
            periodKey,
            periodStart: start,
            periodEnd: end,
        },
    }, { upsert: true, new: true });
    return { doc, periodKey };
};
const getUsageValue = (doc, feature) => {
    return Number(doc?.usage?.[feature] || 0);
};
const checkFeatureQuota = async (user, feature, amount = 1) => {
    const now = new Date();
    const { doc, periodKey } = await ensurePeriodDoc(user._id, now);
    const plan = (0, subscriptionPlans_1.resolveEffectivePlan)(user.subscription);
    const limit = subscriptionPlans_1.PLAN_ENTITLEMENTS[plan][feature];
    const used = getUsageValue(doc, feature);
    if (limit === null) {
        return {
            allowed: true,
            feature,
            limit,
            used,
            remaining: null,
            plan,
            periodKey,
        };
    }
    const allowed = used + amount <= limit;
    return {
        allowed,
        reason: allowed ? undefined : 'quota_exceeded',
        feature,
        limit,
        used,
        remaining: Math.max(0, limit - used),
        plan,
        periodKey,
    };
};
exports.checkFeatureQuota = checkFeatureQuota;
const consumeFeatureQuota = async (userId, feature, amount = 1) => {
    const now = new Date();
    const periodKey = toPeriodKey(now);
    const { start, end } = monthWindow(now);
    await UserQuota_1.default.findOneAndUpdate({ userId, periodKey }, {
        $setOnInsert: {
            userId,
            periodKey,
            periodStart: start,
            periodEnd: end,
        },
        $inc: {
            [`usage.${feature}`]: amount,
        },
    }, { upsert: true });
};
exports.consumeFeatureQuota = consumeFeatureQuota;
const getCurrentUsageSnapshot = async (user) => {
    const now = new Date();
    const { doc, periodKey } = await ensurePeriodDoc(user._id, now);
    const plan = (0, subscriptionPlans_1.resolveEffectivePlan)(user.subscription);
    const entitlements = subscriptionPlans_1.PLAN_ENTITLEMENTS[plan];
    const features = Object.keys(entitlements).map((feature) => {
        const limit = entitlements[feature];
        const used = getUsageValue(doc, feature);
        return {
            feature,
            limit,
            used,
            remaining: limit === null ? null : Math.max(0, limit - used),
        };
    });
    return {
        periodKey,
        plan,
        features,
    };
};
exports.getCurrentUsageSnapshot = getCurrentUsageSnapshot;
