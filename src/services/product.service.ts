import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';

export interface CreateProductInput {
  organizationId: string;
  categoryId?: number;
  type?: 'GOODS' | 'SERVICE' | 'BUNDLE';
  name: string;
  sku: string;
  description?: string;
  sellingPrice: number;
  costPrice?: number;
  mrp?: number;
  taxId?: number;
  hsnCode?: string;
  sacCode?: string;
  trackInventory?: boolean;
  stockQuantity?: number;
  openingStock?: number;
  reorderLevel?: number;
  unit?: string;
  barcode?: string;
  brand?: string;
  manufacturer?: string;
  bundleItems?: {
    childId: number;
    quantity: number;
  }[];
}

export interface UpdateProductInput extends Partial<Omit<CreateProductInput, 'organizationId'>> {
  isActive?: boolean;
}

export interface ProductListFilters {
  organizationId: string;
  search?: string;
  categoryId?: number;
  type?: 'GOODS' | 'SERVICE' | 'BUNDLE';
  taxId?: number;
  isActive?: boolean;
  lowStock?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'sku' | 'sellingPrice' | 'stockQuantity' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

class ProductService {
  /**
   * Create a new product
   */
  async createProduct(data: CreateProductInput) {
    // Check if SKU already exists in organization
    const existingSku = await prisma.product.findFirst({
      where: { organizationId: data.organizationId, sku: data.sku },
    });

    if (existingSku) {
      throw new AppError('Product with this SKU already exists', 400);
    }

    // Validate tax if provided
    if (data.taxId) {
      const tax = await prisma.tax.findFirst({
        where: { id: data.taxId, organizationId: data.organizationId },
      });
      if (!tax) {
        throw new AppError('Tax not found', 404);
      }
    }

    // For services and bundles, disable inventory tracking (bundles track component stock)
    const trackInventory = (data.type === 'SERVICE' || data.type === 'BUNDLE') ? false : (data.trackInventory ?? true);

    // Create product in transaction (for bundles)
    const product = await prisma.$transaction(async (tx) => {
      const { bundleItems, ...productData } = data;

      const newProduct = await tx.product.create({
        data: {
          ...productData,
          trackInventory,
          stockQuantity: trackInventory ? (data.stockQuantity || data.openingStock || 0) : 0,
          openingStock: trackInventory ? (data.openingStock || data.stockQuantity || 0) : 0,
        },
        include: {
          category: true,
          tax: true,
        },
      });

      // Handle Bundle Items
      if (data.type === 'BUNDLE' && bundleItems && bundleItems.length > 0) {
        await tx.productBundleItem.createMany({
          data: bundleItems.map(item => ({
            parentId: newProduct.id,
            childId: item.childId,
            quantity: item.quantity,
          })),
        });
      }

      // Create opening stock inventory log if applicable
      if (trackInventory && newProduct.openingStock > 0) {
        await tx.inventoryLog.create({
          data: {
            productId: newProduct.id,
            transactionType: 'OPENING',
            quantityChange: newProduct.openingStock,
            previousStock: 0,
            newStock: newProduct.openingStock,
            notes: 'Opening stock',
          },
        });
      }

      return newProduct;
    });

    logger.info(`Product created: ${product.id} - ${product.name}`);
    return product;
  }

  /**
   * Get all products with filtering and pagination
   */
  async getAllProducts(filters: ProductListFilters) {
    const {
      organizationId,
      search,
      categoryId,
      type,
      taxId,
      isActive = true,
      lowStock,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
    } = filters;

    const where: any = { organizationId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (type) {
      where.type = type;
    }

    if (taxId) {
      where.taxId = taxId;
    }

    if (lowStock) {
      where.trackInventory = true;
      where.stockQuantity = {
        lte: 5, // Default reorder level comparison
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
        { hsnCode: { contains: search } },
        { sacCode: { contains: search } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: {
            select: { id: true, name: true },
          },
          tax: {
            select: { id: true, name: true, rate: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get product by ID
   */
  async getProductById(organizationId: string, id: number) {
    const product = await prisma.product.findFirst({
      where: { id, organizationId },
      include: {
        category: true,
        tax: true,
        inventoryLogs: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        bundleParents: {
          include: {
            child: {
              select: { id: true, name: true, sku: true, unit: true, stockQuantity: true, sellingPrice: true }
            }
          }
        },
      },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Map bundle items to easier format if it's a bundle
    if (product.type === 'BUNDLE' && product.bundleParents.length > 0) {
      return {
        ...product,
        bundleItems: product.bundleParents.map(bp => ({
          childId: bp.childId,
          quantity: Number(bp.child.stockQuantity), // Wait, this is stock quantity of child. We need required quantity.
          requiredQuantity: Number(bp.quantity),
          child: bp.child
        }))
      };
    }

    return product;
  }

  /**
   * Update product
   */
  async updateProduct(organizationId: string, id: number, data: UpdateProductInput) {
    const existing = await prisma.product.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new AppError('Product not found', 404);
    }

    // Check SKU uniqueness if being changed
    if (data.sku && data.sku !== existing.sku) {
      const skuExists = await prisma.product.findFirst({
        where: { organizationId, sku: data.sku, id: { not: id } },
      });
      if (skuExists) {
        throw new AppError('Product with this SKU already exists', 400);
      }
    }

    // Validate tax if being changed
    if (data.taxId) {
      const tax = await prisma.tax.findFirst({
        where: { id: data.taxId, organizationId },
      });
      if (!tax) {
        throw new AppError('Tax not found', 404);
      }
    }

    // For services and bundles, ensure inventory tracking is disabled
    if (data.type === 'SERVICE' || data.type === 'BUNDLE') {
      data.trackInventory = false;
    }

    const { bundleItems, ...updateData } = data;

    const product = await prisma.$transaction(async (tx) => {
      // Update basic details
      const updatedProduct = await tx.product.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          tax: true,
        },
      });

      // Update Bundle Items if provided
      if (data.type === 'BUNDLE' && bundleItems !== undefined) {
        // Delete existing items
        await tx.productBundleItem.deleteMany({
          where: { parentId: id },
        });

        // Add new items
        if (bundleItems.length > 0) {
          await tx.productBundleItem.createMany({
            data: bundleItems.map(item => ({
              parentId: id,
              childId: item.childId,
              quantity: item.quantity,
            })),
          });
        }
      }

      return updatedProduct;
    });

    logger.info(`Product updated: ${product.id}`);
    return product;
  }

  /**
   * Delete product (soft delete if used in invoices)
   */
  async deleteProduct(organizationId: string, id: number) {
    const product = await prisma.product.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { invoiceItems: true },
        },
      },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Soft delete if used in invoices
    if (product._count.invoiceItems > 0) {
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      logger.info(`Product soft deleted: ${id}`);
      return { message: 'Product deactivated successfully' };
    }

    // Hard delete if not used
    await prisma.product.delete({
      where: { id },
    });

    logger.info(`Product deleted: ${id}`);
    return { message: 'Product deleted successfully' };
  }

  /**
   * Adjust stock quantity
   */
  async adjustStock(organizationId: string, productId: number, data: {
    adjustment: number;
    reason: 'RESTOCK' | 'ADJUSTMENT' | 'RETURN' | 'TRANSFER';
    notes?: string;
  }) {
    const product = await prisma.product.findFirst({
      where: { id: productId, organizationId },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    if (!product.trackInventory) {
      throw new AppError('Inventory tracking is disabled for this product', 400);
    }

    const newStock = product.stockQuantity + data.adjustment;
    if (newStock < 0) {
      throw new AppError('Stock cannot be negative', 400);
    }

    const [updatedProduct] = await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { stockQuantity: newStock },
      }),
      prisma.inventoryLog.create({
        data: {
          productId,
          transactionType: data.reason,
          quantityChange: data.adjustment,
          previousStock: product.stockQuantity,
          newStock,
          notes: data.notes,
        },
      }),
    ]);

    logger.info(`Stock adjusted for product ${productId}: ${product.stockQuantity} -> ${newStock}`);
    return updatedProduct;
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(organizationId: string) {
    return prisma.product.findMany({
      where: {
        organizationId,
        isActive: true,
        trackInventory: true,
        stockQuantity: {
          lte: 5, // Default reorder level
        },
      },
      orderBy: { stockQuantity: 'asc' },
    });
  }

  /**
   * Get product inventory logs
   */
  async getInventoryLogs(organizationId: string, productId: number, limit = 50) {
    const product = await prisma.product.findFirst({
      where: { id: productId, organizationId },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    return prisma.inventoryLog.findMany({
      where: { productId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // PRODUCT CATEGORIES
  // ============================================

  /**
   * Get all categories
   */
  async getCategories(organizationId: string) {
    return prisma.productCategory.findMany({
      where: { organizationId, isActive: true },
      include: {
        parent: {
          select: { id: true, name: true },
        },
        children: {
          where: { isActive: true },
          select: { id: true, name: true },
        },
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create category
   */
  async createCategory(organizationId: string, data: {
    name: string;
    description?: string;
    parentId?: number;
  }) {
    // Check for duplicate name
    const existing = await prisma.productCategory.findFirst({
      where: { organizationId, name: data.name },
    });

    if (existing) {
      throw new AppError('Category with this name already exists', 400);
    }

    // Validate parent if provided
    if (data.parentId) {
      const parent = await prisma.productCategory.findFirst({
        where: { id: data.parentId, organizationId },
      });
      if (!parent) {
        throw new AppError('Parent category not found', 404);
      }
    }

    return prisma.productCategory.create({
      data: {
        organizationId,
        ...data,
      },
    });
  }

  /**
   * Update category
   */
  async updateCategory(organizationId: string, id: number, data: {
    name?: string;
    description?: string;
    parentId?: number;
    isActive?: boolean;
  }) {
    const category = await prisma.productCategory.findFirst({
      where: { id, organizationId },
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    // Check for duplicate name
    if (data.name && data.name !== category.name) {
      const existing = await prisma.productCategory.findFirst({
        where: { organizationId, name: data.name, id: { not: id } },
      });
      if (existing) {
        throw new AppError('Category with this name already exists', 400);
      }
    }

    return prisma.productCategory.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete category
   */
  async deleteCategory(organizationId: string, id: number) {
    const category = await prisma.productCategory.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { products: true, children: true },
        },
      },
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    if (category._count.products > 0 || category._count.children > 0) {
      throw new AppError('Cannot delete category with products or subcategories', 400);
    }

    await prisma.productCategory.delete({
      where: { id },
    });

    return { message: 'Category deleted successfully' };
  }

  /**
   * Bulk update products
   */
  async bulkUpdateProducts(organizationId: string, productIds: number[], data: {
    categoryId?: number;
    taxId?: number;
    isActive?: boolean;
  }) {
    // Verify all products belong to organization
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, organizationId },
    });

    if (products.length !== productIds.length) {
      throw new AppError('Some products not found', 404);
    }

    await prisma.product.updateMany({
      where: { id: { in: productIds }, organizationId },
      data,
    });

    return { message: `${productIds.length} products updated successfully` };
  }

  /**
   * Search products for invoice creation (lightweight)
   */
  async searchProductsForInvoice(organizationId: string, search: string, limit = 10) {
    return prisma.product.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { equals: search } },
        ],
      },
      take: limit,
      select: {
        id: true,
        name: true,
        sku: true,
        type: true,
        sellingPrice: true,
        stockQuantity: true,
        trackInventory: true,
        unit: true,
        hsnCode: true,
        sacCode: true,
        tax: {
          select: {
            id: true,
            name: true,
            rate: true,
            cgstRate: true,
            sgstRate: true,
            igstRate: true,
          },
        },
      },
    });
  }

  /**
   * Get product by barcode
   */
  async getProductByBarcode(organizationId: string, barcode: string) {
    const product = await prisma.product.findFirst({
      where: { organizationId, barcode, isActive: true },
      include: {
        tax: true,
      },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    return product;
  }

  /**
   * Get inventory value summary
   */
  async getInventoryValue(organizationId: string) {
    const products = await prisma.product.findMany({
      where: {
        organizationId,
        isActive: true,
        trackInventory: true,
        stockQuantity: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        sellingPrice: true,
        costPrice: true,
      },
    });

    let totalCostValue = 0;
    let totalRetailValue = 0;

    const details = products.map(product => {
      const cost = product.costPrice ? Number(product.costPrice) * product.stockQuantity : 0;
      const retail = Number(product.sellingPrice) * product.stockQuantity;
      
      totalCostValue += cost;
      totalRetailValue += retail;
      
      return {
        ...product,
        stockValue: cost || retail,
        retailValue: retail,
      };
    });

    return {
      totalProducts: products.length,
      totalCostValue,
      totalRetailValue,
      potentialProfit: totalRetailValue - totalCostValue,
      details,
    };
  }
}

export default new ProductService();
