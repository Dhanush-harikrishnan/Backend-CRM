import { Router, Response, NextFunction } from 'express';
import customerService from '../services/customer.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createCustomerSchema, updateCustomerSchema, customerListQuerySchema, createCustomerGroupSchema } from '../validators';
import { AppError } from '../middleware/error.middleware';

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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const customer = await customerService.createCustomer({
        organizationId: req.user.organizationId,
        ...req.body,
      });
      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: customer,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/customers
 * @desc    Get all customers with filters
 * @access  Private
 */
router.get(
  '/',
  validate(customerListQuerySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const result = await customerService.getAllCustomers({
        organizationId: req.user.organizationId,
        customerType: req.query.customerType as any,
        customerGroupId: req.query.groupId ? Number(req.query.groupId) : undefined,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
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
 * @route   GET /api/customers/groups
 * @desc    Get all customer groups
 * @access  Private
 */
router.get(
  '/groups',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const groups = await customerService.getCustomerGroups(req.user.organizationId);
      res.json({ success: true, data: groups });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/customers/groups
 * @desc    Create customer group
 * @access  Private
 */
router.post(
  '/groups',
  validate(createCustomerGroupSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const group = await customerService.createCustomerGroup(
        req.user.organizationId,
        req.body
      );
      res.status(201).json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/customers/:id
 * @desc    Get customer by ID
 * @access  Private
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const customer = await customerService.getCustomerById(
        req.user.organizationId,
        Number(req.params.id)
      );
      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/customers/:id
 * @desc    Update customer
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateCustomerSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const customer = await customerService.updateCustomer(
        req.user.organizationId,
        Number(req.params.id),
        req.body
      );
      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/customers/:id/statement
 * @desc    Get customer statement
 * @access  Private
 */
router.get(
  '/:id/statement',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const dateRange = req.query.from && req.query.to
        ? { from: new Date(req.query.from as string), to: new Date(req.query.to as string) }
        : undefined;
      const statement = await customerService.getCustomerStatement(
        req.user.organizationId,
        Number(req.params.id),
        dateRange
      );
      res.json({ success: true, data: statement });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/customers/:id/contacts
 * @desc    Add contact to customer
 * @access  Private
 */
router.post(
  '/:id/contacts',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const contact = await customerService.addContact(
        req.user.organizationId,
        Number(req.params.id),
        req.body
      );
      res.status(201).json({ success: true, data: contact });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/customers/:id/contacts/:contactId
 * @desc    Update contact
 * @access  Private
 */
router.put(
  '/:id/contacts/:contactId',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const contact = await customerService.updateContact(
        req.user.organizationId,
        Number(req.params.id),
        Number(req.params.contactId),
        req.body
      );
      res.json({ success: true, data: contact });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/customers/:id
 * @desc    Soft delete customer (deactivate)
 * @access  Private
 */
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const customer = await customerService.updateCustomer(
        req.user.organizationId,
        Number(req.params.id),
        { isActive: false }
      );
      res.json({ success: true, message: 'Customer deactivated', data: customer });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
