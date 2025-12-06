import { Request, Response, NextFunction } from 'express';
import { handleStripeWebhook } from '../services/stripeService';

export const stripeWebhookHandler = async (req: Request, res: Response, next: NextFunction) => {
  const sig = req.headers['stripe-signature'] as string;
  const payload = req.rawBody.toString(); // assuming rawBody is available due to specific middleware

  try {
    const event = await handleStripeWebhook(payload, sig);
    // Respond to Stripe that the event was received successfully
    res.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
};