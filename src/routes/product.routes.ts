import { Router } from 'express';
import productController from '../controllers/product.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createProductSchema,
  updateProductSchema,
  updateStockSchema,
} from '../validators';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/products/low-stock
 * @desc    Get low stock products (alert)
 * @access  Private
 */
router.get('/low-stock', productController.getLowStockProducts);

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Private (Admin only)
 */
router.post(
  '/',
  authorize('ADMIN'),
  validate(createProductSchema),
  productController.createProduct
);

/**
 * @route   GET /api/products
 * @desc    Get all products
 * @access  Private
 */
router.get('/', productController.getAllProducts);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Private
 */
router.get('/:id', productController.getProductById);

/**
 * @route   PUT /api/products/:id
 * @desc    Update product
 * @access  Private (Admin only)
 */
router.put(
  '/:id',
  authorize('ADMIN'),
  validate(updateProductSchema),
  productController.updateProduct
);

/**
 * @route   PATCH /api/products/:id/stock
 * @desc    Update product stock (restock/adjustment)
 * @access  Private (Admin only)
 */
router.patch(
  '/:id/stock',
  authorize('ADMIN'),
  validate(updateStockSchema),
  productController.updateStock
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete (deactivate) product
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authorize('ADMIN'),
  productController.deleteProduct
);

export default router;
