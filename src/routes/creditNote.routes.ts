import { Router, Response, NextFunction } from 'express';
import creditNoteService from '../services/creditNote.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createCreditNoteSchema, creditNoteListQuerySchema, applyCreditNoteSchema } from '../validators';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/credit-notes
 * @desc    Create new credit note
 * @access  Private
 */
router.post(
  '/',
  validate(createCreditNoteSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const creditNote = await creditNoteService.createCreditNote({
        organizationId: req.user.organizationId,
        ...req.body,
      });
      res.status(201).json({
        success: true,
        message: 'Credit note created successfully',
        data: creditNote,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/credit-notes/from-invoice/:invoiceId
 * @desc    Create credit note from invoice (return items)
 * @access  Private
 */
router.post(
  '/from-invoice/:invoiceId',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const { itemsToReturn } = req.body;
      
      if (!itemsToReturn || !Array.isArray(itemsToReturn) || itemsToReturn.length === 0) {
        throw new AppError('Items to return are required', 400);
      }
      
      const creditNote = await creditNoteService.createFromInvoice(
        req.user.organizationId,
        Number(req.params.invoiceId),
        itemsToReturn
      );
      res.status(201).json({
        success: true,
        message: 'Credit note created from invoice successfully',
        data: creditNote,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/credit-notes
 * @desc    Get all credit notes with filters
 * @access  Private
 */
router.get(
  '/',
  validate(creditNoteListQuerySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const result = await creditNoteService.getAllCreditNotes({
        organizationId: req.user.organizationId,
        customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
        invoiceId: req.query.invoiceId ? Number(req.query.invoiceId) : undefined,
        status: req.query.status as any,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
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
 * @route   GET /api/credit-notes/:id
 * @desc    Get credit note by ID
 * @access  Private
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const creditNote = await creditNoteService.getCreditNoteById(
        req.user.organizationId,
        Number(req.params.id)
      );
      res.json({ success: true, data: creditNote });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/credit-notes/:id/status
 * @desc    Update credit note status
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
      const creditNote = await creditNoteService.updateStatus(
        req.user.organizationId,
        Number(req.params.id),
        status
      );
      res.json({ success: true, data: creditNote });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/credit-notes/:id/apply
 * @desc    Apply credit note to invoice
 * @access  Private
 */
router.post(
  '/:id/apply',
  validate(applyCreditNoteSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const { invoiceId, amount } = req.body;
      const result = await creditNoteService.applyToInvoice(
        req.user.organizationId,
        Number(req.params.id),
        invoiceId,
        amount
      );
      res.json({
        success: true,
        message: 'Credit note applied successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/credit-notes/:id
 * @desc    Delete credit note (void)
 * @access  Private
 */
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const result = await creditNoteService.deleteCreditNote(
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
