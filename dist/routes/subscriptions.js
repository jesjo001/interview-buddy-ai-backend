"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const User_1 = __importDefault(require("../models/User"));
const emailService_1 = require("../services/emailService");
const types_1 = require("../types");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
/**
 * GET /api/billing/subscription
 * Get current subscription details
 */
router.get('/subscription', async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user?._id).select('subscription renewalTracking email name');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            subscription: user.subscription,
            renewalTracking: user.renewalTracking,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch subscription details' });
    }
});
/**
 * POST /api/billing/cancel
 * Cancel current subscription
 */
router.post('/cancel', async (req, res) => {
    try {
        const userId = req.user?._id;
        const { reason } = req.body;
        const user = await User_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { plan, status } = user.subscription;
        // Check if user has active subscription
        if (plan === 'free' || status !== types_1.SubscriptionStatus.ACTIVE) {
            return res.status(400).json({ error: 'No active subscription to cancel' });
        }
        // Update subscription to cancelled
        user.subscription.status = types_1.SubscriptionStatus.CANCELED;
        user.subscription.validUntil = new Date();
        await user.save();
        // Send cancellation email
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Subscription Cancelled</h2>
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Your subscription has been cancelled effective immediately.</p>
        <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Plan:</strong> ${plan.charAt(0).toUpperCase() + plan.slice(1)}</p>
          <p><strong>Status:</strong> Cancelled</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        </div>
        <p>You now have access to the Free plan only.</p>
        <p>Best regards,<br>Interview Prep AI Team</p>
      </div>
    `;
        try {
            await (0, emailService_1.sendEmail)({
                to: user.email,
                subject: 'Subscription Cancelled',
                html,
            });
        }
        catch (emailError) {
            console.error('Failed to send cancellation email:', emailError);
        }
        res.json({ message: 'Subscription cancelled', subscription: user.subscription });
    }
    catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});
/**
 * POST /api/billing/pause
 * Pause subscription temporarily
 */
router.post('/pause', async (req, res) => {
    try {
        const userId = req.user?._id;
        const { daysToResume = 30 } = req.body;
        const user = await User_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { plan, status } = user.subscription;
        if (plan === 'free' || status !== types_1.SubscriptionStatus.ACTIVE) {
            return res.status(400).json({ error: 'No active subscription to pause' });
        }
        // Set pause (mark as expired to disable features, but keep plan info)
        user.subscription.validUntil = new Date();
        const resumeDate = new Date();
        resumeDate.setDate(resumeDate.getDate() + daysToResume);
        user.renewalTracking = user.renewalTracking || { failedRenewalAttempts: 0 };
        user.renewalTracking.nextRenewalDate = resumeDate;
        await user.save();
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Subscription Paused</h2>
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Your subscription has been paused. You can resume anytime.</p>
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Will Auto-Resume:</strong> ${resumeDate.toLocaleDateString()}</p>
        </div>
        <p>
          <a href="${process.env.FRONTEND_URL?.split(',')[0]?.trim()}/settings?tab=billing" 
             style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Manage Subscription
          </a>
        </p>
        <p>Best regards,<br>Interview Prep AI Team</p>
      </div>
    `;
        try {
            await (0, emailService_1.sendEmail)({
                to: user.email,
                subject: 'Subscription Paused',
                html,
            });
        }
        catch (emailError) {
            console.error('Failed to send pause email:', emailError);
        }
        res.json({ message: 'Subscription paused', resumeDate: resumeDate.toISOString() });
    }
    catch (error) {
        console.error('Error pausing subscription:', error);
        res.status(500).json({ error: 'Failed to pause subscription' });
    }
});
/**
 * POST /api/billing/resume
 * Resume a paused subscription
 */
router.post('/resume', async (req, res) => {
    try {
        const userId = req.user?._id;
        const user = await User_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { plan } = user.subscription;
        const renewalTracking = user.renewalTracking || { failedRenewalAttempts: 0 };
        if (plan === 'free') {
            return res.status(400).json({ error: 'No paused subscription to resume' });
        }
        // Restore subscription validity based on renewal date or plan duration
        const planValidityDays = plan === 'enterprise' ? 365 : 30;
        const newValidUntil = new Date();
        newValidUntil.setDate(newValidUntil.getDate() + planValidityDays);
        user.subscription.status = types_1.SubscriptionStatus.ACTIVE;
        user.subscription.validUntil = newValidUntil;
        user.renewalTracking = { failedRenewalAttempts: 0 };
        await user.save();
        res.json({ message: 'Subscription resumed', validUntil: newValidUntil.toISOString() });
    }
    catch (error) {
        console.error('Error resuming subscription:', error);
        res.status(500).json({ error: 'Failed to resume subscription' });
    }
});
exports.default = router;
