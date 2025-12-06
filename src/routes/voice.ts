import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { synthesizeContent, logVoiceStudySession } from '../controllers/voiceController';

const router = Router();

router.use(authenticate); // All voice routes are protected

router.post('/synthesize', synthesizeContent);
router.post('/session', logVoiceStudySession);

export default router;
