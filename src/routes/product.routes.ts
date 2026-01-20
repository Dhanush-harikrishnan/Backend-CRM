import { Router, Response, NextFunction } from 'express';
import productService from '../services/product.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createProductSchema, updateProductSchema, productListQuerySchema, adjustStockSchema, createProductCategorySchema } from '../validators';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Private
 */
router.post(
  '/',
  validate(createProductSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const product = await productService.createProduct({
        organizationId: req.user.organizationId,
        ...req.body,
      });
      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/products
 * @desc    Get all products with filters
 * @access  Private
 */
router.get(
  '/',
  validate(productListQuerySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const result = await productService.getAllProducts({
        organizationId: req.user.organizationId,
        type: req.query.type as any,
        categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        lowStock: req.query.lowStock === 'true',
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
 * @route   GET /api/products/search
 * @desc    Search products for invoice (quick search)
 * @access  Private
 */
router.get(
  '/search',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const query = req.query.q as string || '';
      const products = await productService.searchProductsForInvoice(req.user.organizationId, query);
      res.json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/products/low-stock
 * @desc    Get low stock products
 * @access  Private
 */
router.get(
  '/low-stock',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const products = await productService.getLowStockProducts(req.user.organizationId);
      res.json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/products/inventory-value
 * @desc    Get total inventory value
 * @access  Private
 */
router.get(
  '/inventory-value',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const value = await productService.getInventoryValue(req.user.organizationId);
      res.json({ success: true, data: value });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/products/categories
 * @desc    Get all product categories
 * @access  Private
 */
router.get(
  '/categories',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const categories = await productService.getCategories(req.user.organizationId);
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/products/categories
 * @desc    Create product category
 * @access  Private
 */
router.post(
  '/categories',
  validate(createProductCategorySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const category = await productService.createCategory(
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
 * @route   GET /api/products/barcode/:barcode
 * @desc    Get product by barcode
 * @access  Private
 */
router.get(
  '/barcode/:barcode',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const product = await productService.getProductByBarcode(
        req.user.organizationId,
        req.params.barcode
      );
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Private
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const product = await productService.getProductById(
        req.user.organizationId,
        Number(req.params.id)
      );
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/products/:id
 * @desc    Update product
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateProductSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const product = await productService.updateProduct(
        req.user.organizationId,
        Number(req.params.id),
        req.body
      );
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/products/:id/adjust-stock
 * @desc    Adjust product stock
 * @access  Private
 */
router.post(
  '/:id/adjust-stock',
  validate(adjustStockSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const { adjustment, reason, notes } = req.body;
      const product = await productService.adjustStock(
        req.user.organizationId,
        Number(req.params.id),
        { adjustment, reason, notes }
      );
      res.json({ success: true, message: 'Stock adjusted successfully', data: product });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Soft delete product (deactivate)
 * @access  Private
 */
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const product = await productService.updateProduct(
        req.user.organizationId,
        Number(req.params.id),
        { isActive: false }
      );
      res.json({ success: true, message: 'Product deactivated', data: product });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
