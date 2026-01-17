import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import productService from '../services/product.service';

export class ProductController {
  createProduct = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const product = await productService.createProduct(req.body);

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product,
      });
    }
  );

  getAllProducts = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const { category, isActive, search } = req.query;

      const filters = {
        category: category as string | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        search: search as string | undefined,
      };

      const products = await productService.getAllProducts(filters);

      res.status(200).json({
        success: true,
        count: products.length,
        data: products,
      });
    }
  );

  getProductById = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const id = parseInt(req.params.id, 10);
      const product = await productService.getProductById(id);

      res.status(200).json({
        success: true,
        data: product,
      });
    }
  );

  updateProduct = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const id = parseInt(req.params.id, 10);
      const product = await productService.updateProduct(id, req.body);

      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: product,
      });
    }
  );

  updateStock = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const id = parseInt(req.params.id, 10);
      const { quantity, type, notes } = req.body;

      const product = await productService.updateStock(id, quantity, type, notes);

      res.status(200).json({
        success: true,
        message: 'Stock updated successfully',
        data: product,
      });
    }
  );

  getLowStockProducts = asyncHandler(
    async (_req: AuthRequest, res: Response) => {
      const products = await productService.getLowStockProducts();

      res.status(200).json({
        success: true,
        count: products.length,
        data: products,
      });
    }
  );

  deleteProduct = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const id = parseInt(req.params.id, 10);
      const result = await productService.deleteProduct(id);

      res.status(200).json({
        success: true,
        ...result,
      });
    }
  );
}

export default new ProductController();
