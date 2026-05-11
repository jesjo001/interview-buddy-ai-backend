"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RENEWAL_ENABLED = exports.RENEWAL_CHECK_INTERVAL_MS = void 0;
exports.startRenewalWorker = startRenewalWorker;
const database_1 = __importDefault(require("../config/database"));
/**
 * Subscription Renewal Worker
 * Runs periodically to check and process subscription renewals
 *
 * Usage:
 *   npx ts-node src/scripts/subscriptionRenewalWorker.ts
 *
 * Or for production with a scheduler like node-cron:
 *   - Import processSubscriptionRenewals in app.ts
 *   - Schedule with cron expression
 */
const dotenv_1 = __importDefault(require("dotenv"));
const subscriptionRenewalService_1 = require("../services/subscriptionRenewalService");
dotenv_1.default.config();
const RENEWAL_CHECK_INTERVAL_MS = parseInt(process.env.SUBSCRIPTION_RENEWAL_CHECK_INTERVAL_MS || String(60 * 60 * 1000), // Default: 1 hour
10);
exports.RENEWAL_CHECK_INTERVAL_MS = RENEWAL_CHECK_INTERVAL_MS;
const RENEWAL_ENABLED = (process.env.SUBSCRIPTION_RENEWAL_ENABLED || 'true').toLowerCase() === 'true';
exports.RENEWAL_ENABLED = RENEWAL_ENABLED;
/**
 * Initialize and start the renewal worker
 */
async function startRenewalWorker() {
    if (!RENEWAL_ENABLED) {
        console.log('[RenewalWorker] Subscription renewal is disabled via SUBSCRIPTION_RENEWAL_ENABLED');
        return;
    }
    try {
        console.log('[RenewalWorker] Connecting to database...');
        await (0, database_1.default)();
        console.log('[RenewalWorker] Connected to database');
        console.log(`[RenewalWorker] Starting subscription renewal worker (check interval: ${RENEWAL_CHECK_INTERVAL_MS}ms)`);
        // Run immediately on startup
        console.log('[RenewalWorker] Running initial renewal check...');
        const initialResult = await (0, subscriptionRenewalService_1.processSubscriptionRenewals)();
        console.log('[RenewalWorker] Initial check completed:', initialResult);
        // Schedule periodic checks
        setInterval(async () => {
            try {
                console.log('[RenewalWorker] Running scheduled renewal check...');
                const result = await (0, subscriptionRenewalService_1.processSubscriptionRenewals)();
                console.log('[RenewalWorker] Scheduled check completed:', result);
            }
            catch (error) {
                console.error('[RenewalWorker] Error in scheduled renewal check:', error);
            }
        }, RENEWAL_CHECK_INTERVAL_MS);
    }
    catch (error) {
        console.error('[RenewalWorker] Fatal error starting renewal worker:', error);
        process.exit(1);
    }
}
// Start the worker if this script is run directly
if (require.main === module) {
    startRenewalWorker().catch((error) => {
        console.error('[RenewalWorker] Startup error:', error);
        process.exit(1);
    });
}
