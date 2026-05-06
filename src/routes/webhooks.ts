import { Router, Request, Response } from 'express';
import bodyParser from 'body-parser';
import { flutterwaveWebhookHandler } from '../controllers/webhookController';

const router = Router();

// Flutterwave signature validation needs raw body parsing.
router.post('/flutterwave', bodyParser.raw({ type: 'application/json' }), flutterwaveWebhookHandler);

// Backward-compatible alias during migration.
router.post('/stripe', bodyParser.raw({ type: 'application/json' }), flutterwaveWebhookHandler);

export default router;
