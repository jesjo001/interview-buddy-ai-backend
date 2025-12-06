import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getMindMapByTopicId, updateMindMapByTopicId } from '../controllers/mindMapController';

const router = Router();

router.use(authenticate); // All mind map routes are protected

router.get('/topic/:topicId', getMindMapByTopicId);
router.put('/topic/:topicId', updateMindMapByTopicId);

export default router;
