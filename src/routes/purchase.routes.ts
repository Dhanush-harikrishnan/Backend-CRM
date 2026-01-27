import { Router } from 'express';
import purchaseController from '../controllers/purchase.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createPurchaseSchema,
  updatePurchaseStatusSchema,
  purchaseListQuerySchema
} from '../validators';

const router = Router();

// Protect all routes
router.use(authenticate);

router.post(
  '/',
  authorize('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'),
  validate(createPurchaseSchema),
  purchaseController.createPurchase
);

router.get(
  '/',
  validate(purchaseListQuerySchema),
  purchaseController.getAllPurchases
);

router.get(
  '/:id',
  purchaseController.getPurchaseById
);

router.patch(
  '/:id/status',
  authorize('OWNER', 'ADMIN', 'MANAGER'),
  validate(updatePurchaseStatusSchema),
  purchaseController.updatePurchaseStatus
);

export default router;
