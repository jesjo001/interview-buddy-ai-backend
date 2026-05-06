import { Types } from 'mongoose';
import UserQuota from '../models/UserQuota';
import { SubscriptionPlan, SubscriptionStatus } from '../types';
import {
  MeteredFeatureKey,
  PLAN_ENTITLEMENTS,
  resolveEffectivePlan,
} from '../config/subscriptionPlans';

interface UserWithSubscription {
  _id: Types.ObjectId;
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    validUntil?: Date;
  };
}

interface FeatureUsage {
  feature: MeteredFeatureKey;
  limit: number | null;
  used: number;
  remaining: number | null;
}

interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  feature: MeteredFeatureKey;
  limit: number | null;
  used: number;
  remaining: number | null;
  plan: SubscriptionPlan;
  periodKey: string;
}

const toPeriodKey = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

const monthWindow = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return { start, end };
};

const ensurePeriodDoc = async (userId: Types.ObjectId, date: Date) => {
  const periodKey = toPeriodKey(date);
  const { start, end } = monthWindow(date);

  const doc = await UserQuota.findOneAndUpdate(
    { userId, periodKey },
    {
      $setOnInsert: {
        userId,
        periodKey,
        periodStart: start,
        periodEnd: end,
      },
    },
    { upsert: true, new: true }
  );

  return { doc, periodKey };
};

const getUsageValue = (doc: any, feature: MeteredFeatureKey): number => {
  return Number(doc?.usage?.[feature] || 0);
};

export const checkFeatureQuota = async (
  user: UserWithSubscription,
  feature: MeteredFeatureKey,
  amount: number = 1
): Promise<QuotaCheckResult> => {
  const now = new Date();
  const { doc, periodKey } = await ensurePeriodDoc(user._id, now);
  const plan = resolveEffectivePlan(user.subscription as any);
  const limit = PLAN_ENTITLEMENTS[plan][feature];
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

export const consumeFeatureQuota = async (
  userId: Types.ObjectId,
  feature: MeteredFeatureKey,
  amount: number = 1
) => {
  const now = new Date();
  const periodKey = toPeriodKey(now);
  const { start, end } = monthWindow(now);

  await UserQuota.findOneAndUpdate(
    { userId, periodKey },
    {
      $setOnInsert: {
        userId,
        periodKey,
        periodStart: start,
        periodEnd: end,
      },
      $inc: {
        [`usage.${feature}`]: amount,
      },
    },
    { upsert: true }
  );
};

export const getCurrentUsageSnapshot = async (user: UserWithSubscription) => {
  const now = new Date();
  const { doc, periodKey } = await ensurePeriodDoc(user._id, now);
  const plan = resolveEffectivePlan(user.subscription);
  const entitlements = PLAN_ENTITLEMENTS[plan];

  const features: FeatureUsage[] = (Object.keys(entitlements) as MeteredFeatureKey[]).map((feature) => {
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
