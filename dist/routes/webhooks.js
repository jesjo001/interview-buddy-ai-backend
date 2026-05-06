"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const body_parser_1 = __importDefault(require("body-parser"));
const webhookController_1 = require("../controllers/webhookController");
const router = (0, express_1.Router)();
// Flutterwave signature validation needs raw body parsing.
router.post('/flutterwave', body_parser_1.default.raw({ type: 'application/json' }), webhookController_1.flutterwaveWebhookHandler);
// Backward-compatible alias during migration.
router.post('/stripe', body_parser_1.default.raw({ type: 'application/json' }), webhookController_1.flutterwaveWebhookHandler);
exports.default = router;
