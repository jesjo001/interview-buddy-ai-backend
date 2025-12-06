import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getMe, updateMe, updatePreferences, deleteMe } from '../controllers/userController';

const router = Router();

// All user routes are protected
router.use(authenticate);

router.get('/me', getMe);
router.put('/me', updateMe);
router.put('/preferences', updatePreferences);
router.delete('/me', deleteMe);

export default router;
