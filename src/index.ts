import app from './app';
import connectDB from './config/database';
import { jobQueueService } from './services/queueService';
import { recoverIncompletePreps } from './services/recoveryService';
import { startRenewalWorker } from './scripts/subscriptionRenewalWorker';

const PORT = process.env.PORT || 5000;

const bootstrap = async () => {
  // 1. Connect to MongoDB first — everything depends on it
  await connectDB();

  // 2. Re-enqueue any preps whose AI analysis was interrupted by a crash/restart
  await recoverIncompletePreps();

  // 3. Start the job queue processor
  jobQueueService.start();

    // 4. Start the subscription renewal worker
    await startRenewalWorker();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup error:', err?.message || err);
  process.exit(1);
});
