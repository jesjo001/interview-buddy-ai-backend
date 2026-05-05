"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const database_1 = __importDefault(require("./config/database"));
const queueService_1 = require("./services/queueService");
const recoveryService_1 = require("./services/recoveryService");
const PORT = process.env.PORT || 5000;
const bootstrap = async () => {
    // 1. Connect to MongoDB first — everything depends on it
    await (0, database_1.default)();
    // 2. Re-enqueue any preps whose AI analysis was interrupted by a crash/restart
    await (0, recoveryService_1.recoverIncompletePreps)();
    // 3. Start the job queue processor
    queueService_1.jobQueueService.start();
    app_1.default.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};
bootstrap().catch((err) => {
    console.error('[Bootstrap] Fatal startup error:', err?.message || err);
    process.exit(1);
});
