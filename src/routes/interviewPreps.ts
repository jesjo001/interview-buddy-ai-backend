import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createInterviewPrep,
  getInterviewPreps,
  getInterviewPrepById,
  updateInterviewPrep,
  deleteInterviewPrep,
  analyzeJobDescriptionManually,
  adjustStudyPlan,
} from '../controllers/prepController';
import { upload } from '../services/fileService'; // Import multer upload middleware

const router = Router();

// All interview prep routes are protected
router.use(authenticate);

router.post('/', upload.single('jobDescriptionFile'), createInterviewPrep); // `jobDescriptionFile` is the field name for the file
router.get('/', getInterviewPreps);
router.get('/:id', getInterviewPrepById);
router.put('/:id', updateInterviewPrep);
router.delete('/:id', deleteInterviewPrep);
router.post('/:id/analyze', analyzeJobDescriptionManually); // Manual trigger to re-analyze JD
router.put('/:id/adjust-plan', adjustStudyPlan); // Adjust study plan (e.g., change interview date)

export default router;
