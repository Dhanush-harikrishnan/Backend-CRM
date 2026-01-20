import { Router, Response, NextFunction } from 'express';
import estimateService from '../services/estimate.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createEstimateSchema, updateEstimateSchema, estimateListQuerySchema } from '../validators';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/estimates
 * @desc    Create new estimate
 * @access  Private
 */
router.post(
  '/',
  validate(createEstimateSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const estimate = await estimateService.createEstimate({
        organizationId: req.user.organizationId,
        ...req.body,
      });
      res.status(201).json({
        success: true,
        message: 'Estimate created successfully',
        data: estimate,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/estimates
 * @desc    Get all estimates with filters
 * @access  Private
 */
router.get(
  '/',
  validate(estimateListQuerySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const result = await estimateService.getAllEstimates({
        organizationId: req.user.organizationId,
        customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
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
 * @route   GET /api/estimates/:id
 * @desc    Get estimate by ID
 * @access  Private
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const estimate = await estimateService.getEstimateById(
        req.user.organizationId,
        Number(req.params.id)
      );
      res.json({ success: true, data: estimate });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/estimates/:id
 * @desc    Update estimate
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateEstimateSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const estimate = await estimateService.updateEstimate(
        req.user.organizationId,
        Number(req.params.id),
        req.body
      );
      res.json({ success: true, data: estimate });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/estimates/:id/status
 * @desc    Update estimate status
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
      const estimate = await estimateService.updateStatus(
        req.user.organizationId,
        Number(req.params.id),
        status
      );
      res.json({ success: true, data: estimate });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/estimates/:id/convert
 * @desc    Convert estimate to invoice
 * @access  Private
 */
router.post(
  '/:id/convert',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const invoice = await estimateService.convertToInvoice(
        req.user.organizationId,
        Number(req.params.id)
      );
      res.status(201).json({
        success: true,
        message: 'Estimate converted to invoice successfully',
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/estimates/:id/duplicate
 * @desc    Duplicate estimate
 * @access  Private
 */
router.post(
  '/:id/duplicate',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const estimate = await estimateService.duplicateEstimate(
        req.user.organizationId,
        Number(req.params.id)
      );
      res.status(201).json({
        success: true,
        message: 'Estimate duplicated successfully',
        data: estimate,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/estimates/:id
 * @desc    Delete estimate
 * @access  Private
 */
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const result = await estimateService.deleteEstimate(
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
