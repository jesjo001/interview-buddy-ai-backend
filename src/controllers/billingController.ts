import { NextFunction, Request, Response } from 'express';
import { SubscriptionPlan } from '../types';
import {
  createFlutterwaveCheckoutSession,
  getBillingPlanCatalog,
  verifyFlutterwaveTransaction,
} from '../services/flutterwaveService';
import { getCurrentUsageSnapshot } from '../services/quotaService';

const parseCheckoutPlan = (rawPlan?: string): SubscriptionPlan | null => {
  if (!rawPlan) return null;
  const normalized = rawPlan.toLowerCase().trim();
  if (normalized === SubscriptionPlan.PRO) return SubscriptionPlan.PRO;
  if (normalized === SubscriptionPlan.ENTERPRISE) return SubscriptionPlan.ENTERPRISE;
  if (normalized === SubscriptionPlan.FREE) return SubscriptionPlan.FREE;
  return null;
};

export const getBillingPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const plans = getBillingPlanCatalog();
    return res.status(200).json({
      plans,
      current: req.user.subscription,
    });
  } catch (err) {
    next(err);
  }
};

export const createBillingCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const selectedPlan = parseCheckoutPlan(req.body?.plan);
    if (!selectedPlan) {
      return res.status(400).json({ error: 'Invalid subscription plan selected' });
    }

    if (selectedPlan === SubscriptionPlan.FREE) {
      return res.status(400).json({ error: 'Free plan does not require checkout' });
    }

    const quantity = Number(req.body?.quantity || 1);
    const session = await createFlutterwaveCheckoutSession(
      req.user._id.toString(),
      selectedPlan,
      Number.isFinite(quantity) && quantity > 0 ? quantity : 1
    );

    return res.status(200).json({
      success: true,
      checkoutUrl: session.url,
      txRef: session.tx_ref || session.id,
      plan: selectedPlan,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyBillingCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const txRef = typeof req.body?.txRef === 'string' ? req.body.txRef : undefined;
    const transactionId =
      typeof req.body?.transactionId === 'string' ? req.body.transactionId : undefined;
    const plan = typeof req.body?.plan === 'string' ? req.body.plan : undefined;

    const verification = await verifyFlutterwaveTransaction(req.user._id.toString(), {
      txRef,
      transactionId,
      plan,
    });

    req.user.subscription.plan = verification.plan;

    return res.status(200).json({
      success: true,
      verification,
    });
  } catch (err) {
    next(err);
  }
};

export const getBillingUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const usage = await getCurrentUsageSnapshot(req.user);
    return res.status(200).json({
      success: true,
      usage,
      subscription: req.user.subscription,
    });
  } catch (err) {
    next(err);
  }
};
