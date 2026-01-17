import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createPaymentIntentSchema, createRefundSchema } from '../validators';

const router = Router();

// Public routes
router.get('/config', paymentController.getConfig);
router.post('/webhook', paymentController.handleWebhook);

// Protected routes
router.post(
  '/create-intent',
  authenticate,
  validate(createPaymentIntentSchema),
  paymentController.createPaymentIntent
);

router.get(
  '/intent/:id',
  authenticate,
  paymentController.getPaymentIntent
);

router.post(
  '/confirm/:id',
  authenticate,
  paymentController.confirmPaymentIntent
);

// Admin only routes
router.post(
  '/refund',
  authenticate,
  authorize('ADMIN'),
  validate(createRefundSchema),
  paymentController.createRefund
);

export default router;
