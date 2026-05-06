import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { getAnalytics, listUsers, updateUserRole } from '../controllers/adminController';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/analytics', getAnalytics);
router.get('/users', listUsers);
router.patch('/users/:userId/role', updateUserRole);

export default router;
