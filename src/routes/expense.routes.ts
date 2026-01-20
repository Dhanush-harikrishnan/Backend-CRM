import { Router, Response, NextFunction } from 'express';
import expenseService from '../services/expense.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createExpenseSchema, updateExpenseSchema, expenseListQuerySchema, createExpenseCategorySchema } from '../validators';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/expenses
 * @desc    Create new expense
 * @access  Private
 */
router.post(
  '/',
  validate(createExpenseSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const expense = await expenseService.createExpense({
        organizationId: req.user.organizationId,
        ...req.body,
      });
      res.status(201).json({
        success: true,
        message: 'Expense recorded successfully',
        data: expense,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/expenses
 * @desc    Get all expenses with filters
 * @access  Private
 */
router.get(
  '/',
  validate(expenseListQuerySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const result = await expenseService.getAllExpenses({
        organizationId: req.user.organizationId,
        categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
        vendorName: req.query.vendorName as string,
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
 * @route   GET /api/expenses/summary
 * @desc    Get expense summary
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
      const summary = await expenseService.getExpenseSummary(req.user.organizationId, dateRange);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/expenses/recent
 * @desc    Get recent expenses
 * @access  Private
 */
router.get(
  '/recent',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const expenses = await expenseService.getRecentExpenses(req.user.organizationId, limit);
      res.json({ success: true, data: expenses });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/expenses/categories
 * @desc    Get all expense categories
 * @access  Private
 */
router.get(
  '/categories',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const categories = await expenseService.getCategories(req.user.organizationId);
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/expenses/categories
 * @desc    Create expense category
 * @access  Private
 */
router.post(
  '/categories',
  validate(createExpenseCategorySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const category = await expenseService.createCategory(
        req.user.organizationId,
        req.body
      );
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/expenses/categories/:id
 * @desc    Update expense category
 * @access  Private
 */
router.put(
  '/categories/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const category = await expenseService.updateCategory(
        req.user.organizationId,
        Number(req.params.id),
        req.body
      );
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/expenses/:id
 * @desc    Get expense by ID
 * @access  Private
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const expense = await expenseService.getExpenseById(
        req.user.organizationId,
        Number(req.params.id)
      );
      res.json({ success: true, data: expense });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/expenses/:id
 * @desc    Update expense
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateExpenseSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const expense = await expenseService.updateExpense(
        req.user.organizationId,
        Number(req.params.id),
        req.body
      );
      res.json({ success: true, data: expense });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/expenses/:id
 * @desc    Delete expense
 * @access  Private
 */
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const result = await expenseService.deleteExpense(
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
