import { Router, Request, Response, NextFunction } from 'express';
import organizationService from '../services/organization.service';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createOrganizationSchema, updateOrganizationSchema, createTaxSchema } from '../validators';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// Public route for creating organization (during signup)
router.post(
  '/',
  validate(createOrganizationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await organizationService.createOrganization(req.body);
      res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// All routes below require authentication
router.use(authenticate);

/**
 * @route   GET /api/organizations/current
 * @desc    Get current user's organization
 * @access  Private
 */
router.get(
  '/current',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const org = await organizationService.getOrganizationById(req.user.organizationId);
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/organizations/current
 * @desc    Update current organization
 * @access  Private (Owner/Admin only)
 */
router.put(
  '/current',
  authorize('OWNER', 'ADMIN'),
  validate(updateOrganizationSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const org = await organizationService.updateOrganization(req.user.organizationId, req.body);
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/organizations/dashboard
 * @desc    Get dashboard summary
 * @access  Private
 */
router.get(
  '/dashboard',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const summary = await organizationService.getDashboardSummary(req.user.organizationId);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/organizations/taxes
 * @desc    Get all taxes for organization
 * @access  Private
 */
router.get(
  '/taxes',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const taxes = await organizationService.getTaxes(req.user.organizationId);
      res.json({ success: true, data: taxes });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/organizations/taxes
 * @desc    Create new tax
 * @access  Private (Owner/Admin only)
 */
router.post(
  '/taxes',
  authorize('OWNER', 'ADMIN'),
  validate(createTaxSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const tax = await organizationService.createTax(
        req.user.organizationId,
        req.body
      );
      res.status(201).json({ success: true, data: tax });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/organizations/bank-accounts
 * @desc    Get all bank accounts
 * @access  Private
 */
router.get(
  '/bank-accounts',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const accounts = await organizationService.getBankAccounts(req.user.organizationId);
      res.json({ success: true, data: accounts });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/organizations/states
 * @desc    Get Indian states list
 * @access  Private
 */
router.get(
  '/states',
  async (_req: Request, res: Response) => {
    const states = organizationService.getIndianStates();
    res.json({ success: true, data: states });
  }
);

export default router;
