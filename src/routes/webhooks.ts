import { Router, Request, Response } from 'express';
import bodyParser from 'body-parser';
import { stripeWebhookHandler } from '../controllers/webhookController';

const router = Router();

// Stripe requires the raw body, so we use a different parser for this route.
router.post('/stripe', bodyParser.raw({ type: 'application/json' }), stripeWebhookHandler);

export default router;
