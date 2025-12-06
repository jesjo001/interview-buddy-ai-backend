import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getTopicsByPrepId,
  getTopicById,
  markTopicAsComplete,
  updateTopicMasteryLevel,
} from '../controllers/topicController';

const router = Router();

router.use(authenticate); // All topic routes are protected

router.get('/prep/:prepId', getTopicsByPrepId);
router.get('/:id', getTopicById);
router.put('/:id/complete', markTopicAsComplete);
router.put('/:id/mastery-level', updateTopicMasteryLevel);

export default router;
