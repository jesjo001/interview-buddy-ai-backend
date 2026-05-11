import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { cacheMiddleware } from './middleware/cacheMiddleware';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import interviewPrepRoutes from './routes/interviewPreps';
import topicRoutes from './routes/topics';
import mindMapRoutes from './routes/mindMaps';
import flashcardRoutes from './routes/flashcards';
import voiceRoutes from './routes/voice';
import progressRoutes from './routes/progress';
import mockInterviewRoutes from './routes/mockInterviews'; // Import mock interview routes
import chatbotRoutes from './routes/chatbot';
import webhookRoutes from './routes/webhooks'; // Import webhook routes
import adminRoutes from './routes/admin';
import billingRoutes from './routes/billing';

import subscriptionRoutes from './routes/subscriptions';
dotenv.config();

const app: Application = express();

// Extend Request with optional rawBody for webhook integrations
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

// Security Middleware
app.use(helmet());

// CORS Configuration
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:8082').split(',').map(url => url.trim());
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Request logging
app.use(morgan('dev'));

// Compression for responses (improves bandwidth and perceived speed)
app.use(compression());

// Rate Limiting
app.use(apiLimiter);

// Webhook route - MUST be before express.json() to get raw body
app.use('/api/webhooks', webhookRoutes);

// Body parser
// Body parsers with sensible limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Cache middleware for GET requests (apply it before routes if it should be general)
app.use(cacheMiddleware);

// Routes
app.get('/', (req: Request, res: Response) => {
  res.send('Interview Prep AI Backend API');
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/interview-preps', interviewPrepRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/mind-maps', mindMapRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/mock-interviews', mockInterviewRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingRoutes);

app.use('/api/subscriptions', subscriptionRoutes);
// Error handling middleware
app.use(errorHandler);

export default app;
