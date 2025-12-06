import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getDashboardStats,
  getUserLevelStats,
  logActivity,
} from '../controllers/progressController';

const router = Router();

router.use(authenticate); // All progress routes are protected

router.get('/dashboard/:prepId', getDashboardStats);
router.get('/stats', getUserLevelStats);
router.post('/activity', logActivity);

export default router;
