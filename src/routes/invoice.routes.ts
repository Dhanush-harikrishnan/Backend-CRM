import { Router } from 'express';
import invoiceController from '../controllers/invoice.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createInvoiceSchema,
  getInvoiceByIdSchema,
  getInvoicesQuerySchema,
} from '../validators';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/invoices
 * @desc    Create new invoice
 * @access  Private (Admin & Staff)
 */
router.post(
  '/',
  validate(createInvoiceSchema),
  invoiceController.createInvoice
);

/**
 * @route   GET /api/invoices
 * @desc    Get all invoices with filters
 * @access  Private (Admin & Staff)
 */
router.get(
  '/',
  validate(getInvoicesQuerySchema),
  invoiceController.getInvoices
);

/**
 * @route   GET /api/invoices/summary
 * @desc    Get sales summary
 * @access  Private (Admin only)
 */
router.get(
  '/summary',
  authorize('ADMIN'),
  invoiceController.getSalesSummary
);

/**
 * @route   GET /api/invoices/:id
 * @desc    Get invoice by ID
 * @access  Private (Admin & Staff)
 */
router.get(
  '/:id',
  validate(getInvoiceByIdSchema),
  invoiceController.getInvoiceById
);

export default router;
