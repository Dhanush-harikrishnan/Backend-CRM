import { Router, Response, NextFunction } from 'express';
import invoiceService from '../services/invoice.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createInvoiceSchema, updateInvoiceSchema, invoiceListQuerySchema, recordPaymentSchema } from '../validators';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/invoices
 * @desc    Create new invoice
 * @access  Private
 */
router.post(
  '/',
  validate(createInvoiceSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const invoice = await invoiceService.createInvoice({
        organizationId: req.user.organizationId,
        ...req.body,
        invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : undefined,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      });
      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/invoices
 * @desc    Get all invoices with filters
 * @access  Private
 */
router.get(
  '/',
  validate(invoiceListQuerySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const result = await invoiceService.getAllInvoices({
        organizationId: req.user.organizationId,
        customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
        status: req.query.status as any,
        paymentStatus: req.query.paymentStatus as any,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        overdue: req.query.overdue === 'true',
        search: req.query.search as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/invoices/summary
 * @desc    Get invoice summary
 * @access  Private
 */
router.get(
  '/summary',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const dateRange = req.query.from && req.query.to
        ? { from: new Date(req.query.from as string), to: new Date(req.query.to as string) }
        : undefined;
      const summary = await invoiceService.getInvoiceSummary(req.user.organizationId, dateRange);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/invoices/overdue
 * @desc    Get overdue invoices
 * @access  Private
 */
router.get(
  '/overdue',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const invoices = await invoiceService.getOverdueInvoices(req.user.organizationId);
      res.json({ success: true, data: invoices });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/invoices/:id
 * @desc    Get invoice by ID
 * @access  Private
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const invoice = await invoiceService.getInvoiceById(
        req.user.organizationId,
        Number(req.params.id)
      );
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/invoices/:id
 * @desc    Update invoice (only draft)
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateInvoiceSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const invoice = await invoiceService.updateInvoice(
        req.user.organizationId,
        Number(req.params.id),
        req.body
      );
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/invoices/:id/status
 * @desc    Update invoice status (SENT, VIEWED, VOID)
 * @access  Private
 */
router.patch(
  '/:id/status',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const { status } = req.body;
      const result = await invoiceService.updateStatus(
        req.user.organizationId,
        Number(req.params.id),
        status
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/invoices/:id/payments
 * @desc    Record payment for invoice (Cash, UPI, Card, etc.)
 * @access  Private
 */
router.post(
  '/:id/payments',
  validate(recordPaymentSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const payment = await invoiceService.recordCashPayment(
        req.user.organizationId,
        Number(req.params.id),
        {
          amount: Number(req.body.amount),
          paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : undefined,
          paymentMode: req.body.paymentMode || 'CASH',
          referenceNumber: req.body.referenceNumber,
          notes: req.body.notes,
        }
      );
      res.status(201).json({
        success: true,
        message: 'Payment recorded successfully',
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/invoices/:id/payments
 * @desc    Get payments for invoice
 * @access  Private
 */
router.get(
  '/:id/payments',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const payments = await invoiceService.getInvoicePayments(
        req.user.organizationId,
        Number(req.params.id)
      );
      res.json({ success: true, data: payments });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/invoices/:id/duplicate
 * @desc    Duplicate invoice
 * @access  Private
 */
router.post(
  '/:id/duplicate',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const invoice = await invoiceService.duplicateInvoice(
        req.user.organizationId,
        Number(req.params.id)
      );
      res.status(201).json({
        success: true,
        message: 'Invoice duplicated successfully',
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/invoices/:id
 * @desc    Delete invoice (only draft)
 * @access  Private
 */
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const result = await invoiceService.deleteInvoice(
        req.user.organizationId,
        Number(req.params.id)
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
