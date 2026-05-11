"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhookHandler = exports.flutterwaveWebhookHandler = void 0;
const flutterwaveService_1 = require("../services/flutterwaveService");
const flutterwaveWebhookHandler = async (req, res, next) => {
    const sig = req.headers['flutterwave-signature'] ||
        req.headers['verif-hash'];
    const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
    try {
        await (0, flutterwaveService_1.handleFlutterwaveWebhook)(payload, sig);
        res.json({ received: true });
    }
    catch (err) {
        console.error('Flutterwave webhook error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
};
exports.flutterwaveWebhookHandler = flutterwaveWebhookHandler;
// Compatibility alias while moving naming across the codebase.
exports.stripeWebhookHandler = exports.flutterwaveWebhookHandler;
