import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { CreateProductInput } from '../validators';

export class ProductService {
  async createProduct(data: CreateProductInput) {
    // Check if SKU already exists
    const existingProduct = await prisma.product.findUnique({
      where: { sku: data.sku },
    });

    if (existingProduct) {
      throw new AppError('Product with this SKU already exists', 400);
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        stockQuantity: data.stockQuantity || 0,
      },
    });

    return product;
  }

  async getAllProducts(filters: {
    category?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const { category, isActive, search } = filters;
    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return products;
  }

  async getProductById(id: number) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        inventoryLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    return product;
  }

  async updateProduct(id: number, data: Partial<CreateProductInput>) {
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new AppError('Product not found', 404);
    }

    // If SKU is being updated, check for duplicates
    if (data.sku && data.sku !== existingProduct.sku) {
      const skuExists = await prisma.product.findUnique({
        where: { sku: data.sku },
      });

      if (skuExists) {
        throw new AppError('Product with this SKU already exists', 400);
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    return product;
  }

  async updateStock(
    id: number,
    quantity: number,
    type: 'RESTOCK' | 'ADJUSTMENT',
    notes?: string
  ) {
    return await prisma.$transaction(async (tx: any) => {
      const product = await tx.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const newStock = product.stockQuantity + quantity;

      if (newStock < 0) {
        throw new AppError('Stock cannot be negative', 400);
      }

      // Update stock
      const updatedProduct = await tx.product.update({
        where: { id },
        data: { stockQuantity: newStock },
      });

      // Create inventory log
      await tx.inventoryLog.create({
        data: {
          productId: id,
          transactionType: type,
          quantityChange: quantity,
          previousStock: product.stockQuantity,
          newStock,
          notes,
        },
      });

      return updatedProduct;
    });
  }

  async getLowStockProducts() {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        stockQuantity: {
          lte: prisma.product.fields.minStockAlert,
        },
      },
      orderBy: { stockQuantity: 'asc' },
    });

    return products;
  }

  async deleteProduct(id: number) {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Soft delete by marking as inactive
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Product deactivated successfully' };
  }
}

export default new ProductService();
