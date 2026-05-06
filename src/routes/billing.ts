import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createBillingCheckout,
  getBillingPlans,
  getBillingUsage,
  verifyBillingCheckout,
} from '../controllers/billingController';

const router = Router();

router.use(authenticate);

router.get('/plans', getBillingPlans);
router.get('/usage', getBillingUsage);
router.post('/checkout', createBillingCheckout);
router.post('/verify', verifyBillingCheckout);

export default router;
