import { Router } from 'express';
import vendorController from '../controllers/vendor.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createVendorSchema,
  updateVendorSchema,
  vendorListQuerySchema
} from '../validators';

const router = Router();

// Protect all routes
router.use(authenticate);

router.post(
  '/',
  authorize('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'),
  validate(createVendorSchema),
  vendorController.createVendor
);

router.get(
  '/',
  validate(vendorListQuerySchema),
  vendorController.getAllVendors
);

router.get(
  '/:id',
  vendorController.getVendorById
);

router.put(
  '/:id',
  authorize('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'),
  validate(updateVendorSchema),
  vendorController.updateVendor
);

router.delete(
  '/:id',
  authorize('OWNER', 'ADMIN'),
  vendorController.deleteVendor
);

export default router;
