import { Request, Response, NextFunction } from 'express';
import { handleFlutterwaveWebhook } from '../services/flutterwaveService';

export const flutterwaveWebhookHandler = async (req: Request, res: Response, next: NextFunction) => {
  const sig =
    (req.headers['flutterwave-signature'] as string | undefined) ||
    (req.headers['verif-hash'] as string | undefined);
  const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});

  try {
    await handleFlutterwaveWebhook(payload, sig);
    res.json({ received: true });
  } catch (err: any) {
    console.error('Flutterwave webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

// Compatibility alias while moving naming across the codebase.
export const stripeWebhookHandler = flutterwaveWebhookHandler;