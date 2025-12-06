import app from './app';
import connectDB from './config/database';
import { jobQueueService } from './services/queueService'; // Import the job queue

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Start the job queue (even if in-memory, it needs to be initialized)
jobQueueService.start();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
