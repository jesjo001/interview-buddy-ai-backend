import User, { IUser } from '../models/User';
import { SubscriptionPlan, SubscriptionStatus } from '../types';
import { sendEmail } from './emailService';
import { createFlutterwaveCheckoutSession, verifyFlutterwaveTransaction } from './flutterwaveService';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface RenewalResult {
  success: boolean;
  userId: string;
  error?: string;
  attemptCount?: number;
}

const MAX_RENEWAL_RETRIES = parseInt(process.env.SUBSCRIPTION_RENEWAL_MAX_RETRIES || '3', 10);
const RENEWAL_WINDOW_DAYS = parseInt(process.env.SUBSCRIPTION_RENEWAL_DAYS_BEFORE || '7', 10);

const downgradeUserToFreePlan = async (user: IUser) => {
  await User.findByIdAndUpdate(user._id, {
    subscription: {
      ...user.subscription,
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.ACTIVE,
      validUntil: undefined,
      flutterwaveCustomerId: undefined,
      flutterwaveSubscriptionId: undefined,
    },
    renewalTracking: {
      lastRenewalAttempt: new Date(),
      failedRenewalAttempts: MAX_RENEWAL_RETRIES,
      nextRenewalDate: undefined,
    },
  });

  console.log(
    `[RenewalService] User ${user._id} downgraded to FREE plan after ${MAX_RENEWAL_RETRIES} failed renewal attempts`
  );
};

/**
 * Attempt to renew a subscription by charging the customer again
 */
export const attemptSubscriptionRenewal = async (user: IUser): Promise<RenewalResult> => {
  try {
    const { plan, validUntil } = user.subscription;
    const renewalTracking = user.renewalTracking || { failedRenewalAttempts: 0 };

    // Check if user has exhausted retry attempts
    if (renewalTracking.failedRenewalAttempts >= MAX_RENEWAL_RETRIES) {
      console.log(`[RenewalService] User ${user._id} has exceeded max renewal retries (${MAX_RENEWAL_RETRIES})`);
      await downgradeUserToFreePlan(user);
      return {
        success: false,
        userId: String(user._id),
        error: 'Max renewal attempts exceeded',
        attemptCount: renewalTracking.failedRenewalAttempts,
      };
    }

    if (plan === SubscriptionPlan.FREE) {
      console.log(`[RenewalService] Free plan user ${user._id} does not need renewal`);
      return { success: true, userId: String(user._id) };
    }

    // Create a new checkout session (simulates re-charge)
    // In a real scenario with stored payment methods, this would use Flutterwave's stored cards
    const checkoutSession = await createFlutterwaveCheckoutSession(String(user._id), plan, 1);

    if (!checkoutSession.url) {
      throw new Error('Failed to create renewal checkout session');
    }

    // Send renewal payment link to customer
    await sendRenewalEmail(user, checkoutSession.url);

    // Update renewal tracking
    await User.findByIdAndUpdate(user._id, {
      'renewalTracking.lastRenewalAttempt': new Date(),
      'renewalTracking.nextRenewalDate': validUntil,
    });

    console.log(`[RenewalService] Renewal attempt initiated for user ${user._id} (plan: ${plan})`);

    return { success: true, userId: String(user._id), attemptCount: renewalTracking.failedRenewalAttempts + 1 };
  } catch (error) {
    console.error(`[RenewalService] Error attempting renewal for user ${user._id}:`, error);

    // Increment failed attempt counter
    const currentAttempts = user.renewalTracking?.failedRenewalAttempts || 0;
    const nextAttemptCount = currentAttempts + 1;

    await User.findByIdAndUpdate(user._id, {
      'renewalTracking.failedRenewalAttempts': nextAttemptCount,
      'renewalTracking.lastRenewalAttempt': new Date(),
    });

    if (nextAttemptCount >= MAX_RENEWAL_RETRIES) {
      await downgradeUserToFreePlan(user);
    }

    return {
      success: false,
      userId: String(user._id),
      error: (error as any)?.message || 'Unknown renewal error',
      attemptCount: nextAttemptCount,
    };
  }
};

/**
 * Find subscriptions expiring within the renewal window
 */
export const findExpiringSubscriptions = async (
  daysBeforeExpiry: number = RENEWAL_WINDOW_DAYS
): Promise<IUser[]> => {
  const now = new Date();
  const renewalWindowStart = new Date(now.getTime() + (daysBeforeExpiry - 1) * 24 * 60 * 60 * 1000);
  const renewalWindowEnd = new Date(now.getTime() + daysBeforeExpiry * 24 * 60 * 60 * 1000);

  const expiringUsers = await User.find({
    'subscription.plan': { $ne: SubscriptionPlan.FREE },
    'subscription.status': SubscriptionStatus.ACTIVE,
    'subscription.validUntil': {
      $gte: renewalWindowStart,
      $lte: renewalWindowEnd,
    },
  }).lean();

  return expiringUsers as IUser[];
};

/**
 * Find subscriptions that have already expired and need renewal
 */
export const findExpiredSubscriptions = async (maxAttempts: number = MAX_RENEWAL_RETRIES): Promise<IUser[]> => {
  const now = new Date();

  const expiredUsers = await User.find({
    'subscription.plan': { $ne: SubscriptionPlan.FREE },
    'subscription.validUntil': { $lt: now },
    'renewalTracking.failedRenewalAttempts': { $lt: maxAttempts },
  }).lean();

  return expiredUsers as IUser[];
};

/**
 * Send renewal reminder email (7 days before expiry)
 */
export const sendRenewalReminderEmail = async (user: IUser): Promise<void> => {
  const { plan, validUntil } = user.subscription;
  const daysLeft = validUntil
    ? Math.ceil((validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const planAmount = getPlanAmount(plan);
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Your Subscription Expires Soon</h2>
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>Your <strong>${planName}</strong> subscription will expire in <strong>${daysLeft} days</strong> (${validUntil?.toLocaleDateString()}).</p>
      <p>To ensure uninterrupted access to premium features, please renew your subscription.</p>
      
      <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Current Plan:</strong> ${planName}</p>
        <p><strong>Renewal Cost:</strong> $${planAmount} USD</p>
        <p><strong>Renewal Period:</strong> ${plan === SubscriptionPlan.ENTERPRISE ? '1 year' : '1 month'}</p>
      </div>

      <p>We'll send you automatic renewal reminders. If your subscription expires, you'll be moved to the Free plan and lose access to premium features.</p>
      
      <p>
        <a href="${process.env.FRONTEND_URL?.split(',')[0]?.trim()}/settings?tab=billing" 
           style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Renew Now
        </a>
      </p>

      <p>Best regards,<br>Interview Prep AI Team</p>
    </div>
  `;

  try {
    await sendEmail({
      to: user.email,
      subject: `Your ${planName} subscription expires in ${daysLeft} days`,
      html,
    });
  } catch (error) {
    console.error(`[RenewalService] Failed to send reminder email to ${user.email}:`, error);
  }
};

/**
 * Send renewal payment link to customer
 */
export const sendRenewalEmail = async (user: IUser, renewalUrl: string): Promise<void> => {
  const { plan } = user.subscription;
  const planAmount = getPlanAmount(plan);
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Ready to Renew Your Subscription?</h2>
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>Your <strong>${planName}</strong> subscription is about to expire. Click the button below to complete your renewal in seconds.</p>
      
      <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Plan:</strong> ${planName}</p>
        <p><strong>Amount:</strong> $${planAmount} USD</p>
      </div>

      <p>
        <a href="${renewalUrl}" 
           style="background: #28a745; color: white; padding: 14px 32px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
          Complete Renewal
        </a>
      </p>

      <p style="color: #666; font-size: 12px;">
        This link expires in 1 hour. If it has expired, you can renew from your account settings.
      </p>

      <p>Best regards,<br>Interview Prep AI Team</p>
    </div>
  `;

  try {
    await sendEmail({
      to: user.email,
      subject: `Complete your ${planName} subscription renewal`,
      html,
    });
  } catch (error) {
    console.error(`[RenewalService] Failed to send renewal email to ${user.email}:`, error);
  }
};

/**
 * Send renewal success notification
 */
export const sendRenewalSuccessEmail = async (user: IUser): Promise<void> => {
  const { plan, validUntil } = user.subscription;
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  const renewalDate = validUntil?.toLocaleDateString();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #28a745;">✓ Renewal Successful!</h2>
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>Your <strong>${planName}</strong> subscription has been successfully renewed.</p>
      
      <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
        <p><strong>Subscription Status:</strong> Active</p>
        <p><strong>Plan:</strong> ${planName}</p>
        <p><strong>Valid Until:</strong> ${renewalDate}</p>
      </div>

      <p>Thank you for your continued subscription to Interview Prep AI!</p>
      
      <p>
        <a href="${process.env.FRONTEND_URL?.split(',')[0]?.trim()}/dashboard" 
           style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Go to Dashboard
        </a>
      </p>

      <p>Best regards,<br>Interview Prep AI Team</p>
    </div>
  `;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Your subscription has been renewed!',
      html,
    });
  } catch (error) {
    console.error(`[RenewalService] Failed to send success email to ${user.email}:`, error);
  }
};

/**
 * Send renewal failure notification
 */
export const sendRenewalFailureEmail = async (user: IUser, attemptCount: number): Promise<void> => {
  const { plan } = user.subscription;
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  const isLastAttempt = attemptCount >= MAX_RENEWAL_RETRIES;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc3545;">⚠ Subscription Renewal Failed</h2>
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>We were unable to renew your <strong>${planName}</strong> subscription. Your subscription may expire soon.</p>
      
      ${
        isLastAttempt
          ? `
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="color: #856404;"><strong>Action Required:</strong> This is our final renewal attempt. Please renew manually to avoid losing access.</p>
        </div>
      `
          : `
        <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p>We will continue to retry. We'll contact you again if the issue persists.</p>
        </div>
      `
      }

      <p>
        <a href="${process.env.FRONTEND_URL?.split(',')[0]?.trim()}/settings?tab=billing" 
           style="background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Renew Manually
        </a>
      </p>

      <p style="color: #666; font-size: 12px;">
        If you continue to experience issues, please contact our support team.
      </p>

      <p>Best regards,<br>Interview Prep AI Team</p>
    </div>
  `;

  try {
    await sendEmail({
      to: user.email,
      subject: `Action Needed: Your subscription renewal failed${isLastAttempt ? ' (Final Attempt)' : ''}`,
      html,
    });
  } catch (error) {
    console.error(`[RenewalService] Failed to send failure email to ${user.email}:`, error);
  }
};

/**
 * Helper to get plan pricing
 */
const getPlanAmount = (plan: SubscriptionPlan): number => {
  const planPricesRaw = process.env.FLUTTERWAVE_PLAN_AMOUNTS_JSON;
  if (!planPricesRaw) {
    return plan === SubscriptionPlan.ENTERPRISE ? 99 : 29;
  }

  try {
    const planPrices = JSON.parse(planPricesRaw) as Record<string, number>;
    const amount = Number(planPrices[plan]);
    if (Number.isFinite(amount) && amount > 0) {
      return amount;
    }
  } catch {
    console.warn('Invalid FLUTTERWAVE_PLAN_AMOUNTS_JSON');
  }

  return plan === SubscriptionPlan.ENTERPRISE ? 99 : 29;
};

/**
 * Main orchestrator: process all renewals
 */
export const processSubscriptionRenewals = async (): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> => {
  try {
    console.log('[RenewalService] Starting subscription renewal check...');

    // Find subscriptions expiring within renewal window
    const expiringUsers = await findExpiringSubscriptions(RENEWAL_WINDOW_DAYS);
    console.log(`[RenewalService] Found ${expiringUsers.length} subscriptions within renewal window`);

    let succeeded = 0;
    let failed = 0;

    for (const user of expiringUsers) {
      // Send renewal reminder email if not sent already
      if (!user.renewalTracking?.lastRenewalAttempt) {
        try {
          await sendRenewalReminderEmail(user);
        } catch (error) {
          console.error(`[RenewalService] Failed to send reminder to ${user.email}:`, error);
        }
      }

      // Attempt renewal on the expiry date itself
      if (
        user.subscription.validUntil &&
        Math.abs(Date.now() - user.subscription.validUntil.getTime()) < 24 * 60 * 60 * 1000
      ) {
        const result = await attemptSubscriptionRenewal(user);
        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
      }
    }

    // Also check expired subscriptions and retry
    const expiredUsers = await findExpiredSubscriptions(MAX_RENEWAL_RETRIES);
    console.log(`[RenewalService] Found ${expiredUsers.length} expired subscriptions to retry`);

    for (const user of expiredUsers) {
      const result = await attemptSubscriptionRenewal(user);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
        // Send failure notification
        const attemptCount = result.attemptCount || (user.renewalTracking?.failedRenewalAttempts || 0) + 1;
        if (attemptCount % 2 === 0 || attemptCount >= MAX_RENEWAL_RETRIES) {
          // Send notification every 2 attempts or on final attempt
          try {
            await sendRenewalFailureEmail(user, attemptCount);
          } catch (error) {
            console.error(`[RenewalService] Failed to send failure email to ${user.email}:`, error);
          }
        }
      }
    }

    const total = expiringUsers.length + expiredUsers.length;
    console.log(
      `[RenewalService] Renewal check completed. Processed: ${total}, Succeeded: ${succeeded}, Failed: ${failed}`
    );

    return {
      processed: total,
      succeeded,
      failed,
    };
  } catch (error) {
    console.error('[RenewalService] Fatal error in renewal process:', error);
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
    };
  }
};
