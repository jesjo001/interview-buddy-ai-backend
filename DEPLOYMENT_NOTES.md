Deployment notes — Interview Prep AI backend

Summary
- This backend has built-in fallbacks for environments where Redis is not available (e.g., cPanel).
- An in-memory job queue (`src/services/queueService.ts`) processes AI tasks in-process. It's suitable for small workloads or temporary hosting. For production, use a Redis-backed queue and a separate worker.
- In-memory caching (`src/middleware/cacheMiddleware.ts`) uses `node-cache` with a 5-minute TTL. Consider enabling Redis for cross-instance caching in production.

What's been implemented
- In-memory job queue with retries and email notifications.
- In-memory caching for GET responses with `Cache-Control` headers set.
- Response compression (`compression`) added to `src/app.ts` to reduce bandwidth.
- Increased body parser limits to 10MB for file uploads.
- MongoDB connection tuned (pool sizes, timeouts) in `src/config/database.ts`. Use `MONGO_MAX_POOL_SIZE`/`MONGO_MIN_POOL_SIZE` env vars to tune.
- Indexes added for common queries: InterviewPrep, Topic, Flashcard models.

cPanel notes (Redis not available)
- Redis features disabled/avoided: the codebase already uses in-memory fallbacks. No Redis configuration required.
- Limitations: in-memory queue/cache will be lost when the process restarts and do not scale across instances. Use this only as a temporary workaround.

Recommended commands (PowerShell)
# from backend folder
npm install
npm run dev

# build and run
npm run build; npm start

Environment variables
- Ensure `.env` or environment variables are set for MongoDB, Flutterwave, SendGrid, OpenAI API, and AWS S3 if used.
- Example entries are present in `.env.example` (now includes `MONGO_MAX_POOL_SIZE`)

Production recommendations
- Provision a Redis instance and switch to Bull (or BullMQ) for job queues when scaling.
- Use a separate worker process for AI-heavy jobs to avoid blocking the web server.
- Use a CDN or S3 for serving TTS/audio files and other static assets.
- Use managed MongoDB (Atlas) with proper indexes and backups.
- Monitor memory usage; in-memory queues can grow if job production outpaces processing.

Contact
- If you want, I can add:
  - Redis detection + automatic Bull integration when REDIS_* env vars present.
  - A separate worker start script and PM2 ecosystem file for process management.
  - Health-check endpoints and uptime probes for cPanel.
