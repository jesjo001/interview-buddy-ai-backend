import { SubscriptionPlan, SubscriptionStatus } from '../types';

export type MeteredFeatureKey =
  | 'interviewPrepCreate'
  | 'mockInterviewStart'
  | 'voiceMinutes'
  | 'chatbotMessage';

export interface PlanEntitlements {
  interviewPrepCreate: number | null;
  mockInterviewStart: number | null;
  voiceMinutes: number | null;
  chatbotMessage: number | null;
}

export const PLAN_ENTITLEMENTS: Record<SubscriptionPlan, PlanEntitlements> = {
  [SubscriptionPlan.FREE]: {
    interviewPrepCreate: 1,
    mockInterviewStart: 0,
    voiceMinutes: 0,
    chatbotMessage: 20,
  },
  [SubscriptionPlan.PRO]: {
    interviewPrepCreate: 8,
    mockInterviewStart: 20,
    voiceMinutes: 300,
    chatbotMessage: 1000,
  },
  [SubscriptionPlan.ENTERPRISE]: {
    interviewPrepCreate: null,
    mockInterviewStart: null,
    voiceMinutes: 3000,
    chatbotMessage: null,
  },
};

interface SubscriptionSnapshot {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  validUntil?: Date;
}

export const resolveEffectivePlan = (subscription: SubscriptionSnapshot): SubscriptionPlan => {
  const now = Date.now();
  const hasAccessByDate = !subscription.validUntil || subscription.validUntil.getTime() >= now;
  const hasActiveStatus =
    subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.CANCELED;

  if (hasActiveStatus && hasAccessByDate) {
    return subscription.plan;
  }

  return SubscriptionPlan.FREE;
};
