import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import productService from '../services/product.service';

export class ProductController {
  createProduct = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const product = await productService.createProduct({
        ...req.body,
        organizationId,
      });

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product,
      });
    }
  );

  getAllProducts = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const { categoryId, isActive, search, type, page, limit, sortBy, sortOrder, lowStock } = req.query;

      const result = await productService.getAllProducts({
        organizationId,
        categoryId: categoryId ? parseInt(categoryId as string, 10) : undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        search: search as string,
        type: type as 'GOODS' | 'SERVICE' | undefined,
        lowStock: lowStock === 'true',
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        sortBy: sortBy as any,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      res.status(200).json({
        success: true,
        count: result.data.length,
        data: result.data,
        pagination: result.pagination,
      });
    }
  );

  getProductById = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);
      const product = await productService.getProductById(organizationId, id);

      res.status(200).json({
        success: true,
        data: product,
      });
    }
  );

  updateProduct = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);
      const product = await productService.updateProduct(organizationId, id, req.body);

      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: product,
      });
    }
  );

  adjustStock = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);
      const { adjustment, reason, notes } = req.body;

      const product = await productService.adjustStock(
        organizationId,
        id,
        { adjustment, reason, notes }
      );

      res.status(200).json({
        success: true,
        message: 'Stock adjusted successfully',
        data: product,
      });
    }
  );

  getLowStockProducts = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const products = await productService.getLowStockProducts(organizationId);

      res.status(200).json({
        success: true,
        count: products.length,
        data: products,
      });
    }
  );

  deleteProduct = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);
      const result = await productService.deleteProduct(organizationId, id);

      res.status(200).json({
        success: true,
        ...result,
      });
    }
  );

  getInventoryValue = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const value = await productService.getInventoryValue(organizationId);

      res.status(200).json({
        success: true,
        data: value,
      });
    }
  );

  getProductByBarcode = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const { barcode } = req.params;
      const product = await productService.getProductByBarcode(organizationId, barcode);

      res.status(200).json({
        success: true,
        data: product,
      });
    }
  );

  searchProducts = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const { query } = req.query;
      
      const result = await productService.getAllProducts({
        organizationId,
        search: query as string,
        limit: 50,
      });

      res.status(200).json({
        success: true,
        count: result.data.length,
        data: result.data,
      });
    }
  );
}

export default new ProductController();
