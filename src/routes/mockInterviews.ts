import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  startMockInterview,
  submitResponse,
  endInterview,
  getInterview,
  getInterviewHistory,
  deleteInterview,
  getReadinessScore,
} from '../controllers/mockInterviewController';

const router: Router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Mock Interview Routes
 */

// Start a new mock interview
router.post('/start', startMockInterview);

// Submit a response to a question
router.post('/:id/respond', submitResponse);

// End interview and calculate score
router.put('/:id/end', endInterview);

// Get specific interview details
router.get('/:id', getInterview);

// Get interview history (with pagination)
router.get('/', getInterviewHistory);

// Delete an interview
router.delete('/:id', deleteInterview);

// Get readiness score for a prep session
router.get('/:prepId/readiness', getReadinessScore);

export default router;
