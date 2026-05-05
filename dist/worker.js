"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const queueService_1 = require("./services/queueService");
dotenv_1.default.config();
const redisUrl = process.env.REDIS_URL || process.env.BULL_REDIS_URL || 'redis://127.0.0.1:6379';
(async () => {
    try {
        // Dynamic import so running worker is optional
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Worker } = require('bullmq');
        const worker = new Worker('prep-jobs', async (job) => {
            console.log('[Worker] Got job', job.name, job.id);
            await (0, queueService_1.handleJob)(job.name, job.data);
        }, { connection: { url: redisUrl } });
        worker.on('completed', (job) => {
            console.log(`[Worker] Job ${job.id} completed.`);
        });
        worker.on('failed', (job, err) => {
            console.error(`[Worker] Job ${job.id} failed:`, err?.message || err);
        });
        console.log('[Worker] Worker started and listening for jobs on Redis at', redisUrl);
    }
    catch (err) {
        console.error('[Worker] Failed to start Bull worker. Ensure `bullmq` is installed and Redis is reachable.', err);
        process.exit(1);
    }
})();
