import { Router, Response, NextFunction } from 'express';
import reportService from '../services/report.service';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { reportDateRangeSchema } from '../validators';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/reports/dashboard
 * @desc    Get dashboard overview
 * @access  Private
 */
router.get(
  '/dashboard',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const data = await reportService.getDashboardOverview(req.user.organizationId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/reports/sales
 * @desc    Get sales report
 * @access  Private
 */
router.get(
  '/sales',
  validate(reportDateRangeSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const dateRange = req.query.from && req.query.to
        ? { from: new Date(req.query.from as string), to: new Date(req.query.to as string) }
        : undefined;
      const data = await reportService.getSalesReport({
        organizationId: req.user.organizationId,
        dateRange,
        customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/reports/tax
 * @desc    Get GST/tax report
 * @access  Private (Manager+ only)
 */
router.get(
  '/tax',
  authorize('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'),
  validate(reportDateRangeSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const dateRange = req.query.from && req.query.to
        ? { from: new Date(req.query.from as string), to: new Date(req.query.to as string) }
        : undefined;
      const data = await reportService.getTaxReport({
        organizationId: req.user.organizationId,
        dateRange,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/reports/receivables-aging
 * @desc    Get receivables aging report
 * @access  Private
 */
router.get(
  '/receivables-aging',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const data = await reportService.getReceivablesAgingReport(req.user.organizationId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/reports/customer-statement/:customerId
 * @desc    Get customer statement
 * @access  Private
 */
router.get(
  '/customer-statement/:customerId',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const dateRange = req.query.from && req.query.to
        ? { from: new Date(req.query.from as string), to: new Date(req.query.to as string) }
        : undefined;
      const data = await reportService.getCustomerStatementReport(
        req.user.organizationId,
        Number(req.params.customerId),
        dateRange
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/reports/expenses
 * @desc    Get expense report
 * @access  Private
 */
router.get(
  '/expenses',
  validate(reportDateRangeSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const dateRange = req.query.from && req.query.to
        ? { from: new Date(req.query.from as string), to: new Date(req.query.to as string) }
        : undefined;
      const data = await reportService.getExpenseReport({
        organizationId: req.user.organizationId,
        dateRange,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/reports/profit-loss
 * @desc    Get profit & loss summary
 * @access  Private (Manager+ only)
 */
router.get(
  '/profit-loss',
  authorize('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'),
  validate(reportDateRangeSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const dateRange = req.query.from && req.query.to
        ? { from: new Date(req.query.from as string), to: new Date(req.query.to as string) }
        : undefined;
      const data = await reportService.getProfitLossSummary({
        organizationId: req.user.organizationId,
        dateRange,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/reports/product-sales
 * @desc    Get product sales report
 * @access  Private
 */
router.get(
  '/product-sales',
  validate(reportDateRangeSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const dateRange = req.query.from && req.query.to
        ? { from: new Date(req.query.from as string), to: new Date(req.query.to as string) }
        : undefined;
      const data = await reportService.getProductSalesReport({
        organizationId: req.user.organizationId,
        dateRange,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
