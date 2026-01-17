import { Router } from 'express';
import customerController from '../controllers/customer.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createCustomerSchema, updateCustomerSchema } from '../validators';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/customers
 * @desc    Create new customer
 * @access  Private
 */
router.post(
  '/',
  validate(createCustomerSchema),
  customerController.createCustomer
);

/**
 * @route   GET /api/customers
 * @desc    Get all customers
 * @access  Private
 */
router.get('/', customerController.getAllCustomers);

/**
 * @route   GET /api/customers/:id
 * @desc    Get customer by ID
 * @access  Private
 */
router.get('/:id', customerController.getCustomerById);

/**
 * @route   PUT /api/customers/:id
 * @desc    Update customer
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateCustomerSchema),
  customerController.updateCustomer
);

/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete customer
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authorize('ADMIN'),
  customerController.deleteCustomer
);

export default router;
