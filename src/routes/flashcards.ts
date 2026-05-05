import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getFlashcardsDueForReview,
  getFlashcardsByTopicId,
  createCustomFlashcard,
  reviewFlashcard,
  updateFlashcard,
  deleteFlashcard,
  getFlashcardsByPrepId,
} from '../controllers/flashcardController';

const router = Router();

router.use(authenticate); // All flashcard routes are protected

router.get('/due', getFlashcardsDueForReview);
router.get('/topic/:topicId', getFlashcardsByTopicId);
router.get('/prep/:prepId', getFlashcardsByPrepId);
router.post('/', createCustomFlashcard);
router.put('/:id', updateFlashcard);
router.post('/:id/review', reviewFlashcard);
router.delete('/:id', deleteFlashcard);

export default router;
