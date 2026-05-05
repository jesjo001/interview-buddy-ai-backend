"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhookHandler = void 0;
const stripeService_1 = require("../services/stripeService");
const stripeWebhookHandler = async (req, res, next) => {
    const sig = req.headers['stripe-signature'];
    const payload = req.rawBody.toString(); // assuming rawBody is available due to specific middleware
    try {
        const event = await (0, stripeService_1.handleStripeWebhook)(payload, sig);
        // Respond to Stripe that the event was received successfully
        res.json({ received: true });
    }
    catch (err) {
        console.error('Stripe webhook error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
};
exports.stripeWebhookHandler = stripeWebhookHandler;
