import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';

export interface CreatePurchaseInput {
  organizationId: string;
  vendorId: number;
  purchaseDate?: string;
  dueDate?: string;
  referenceNumber?: string;
  items: {
    productId: number;
    quantity: number;
    rate: number;
    taxId?: number;
  }[];
  discountAmount?: number;
  adjustmentAmount?: number;
  notes?: string;
  status?: 'DRAFT' | 'SENT' | 'RECEIVED' | 'PARTIALLY_PAID' | 'PAID';
}

export interface PurchaseListFilters {
  organizationId: string;
  search?: string;
  vendorId?: number;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

class PurchaseService {
  /**
   * Create a new purchase
   */
  async createPurchase(data: CreatePurchaseInput) {
    const { items, ...purchaseData } = data;

    // Validate vendor
    const vendor = await prisma.vendor.findFirst({
      where: { id: data.vendorId, organizationId: data.organizationId },
    });

    if (!vendor) {
      throw new AppError('Vendor not found', 404);
    }

    // Process items
    let subtotal = 0;
    let totalTax = 0;
    const processedItems: {
        productId: number;
        quantity: number;
        unit: string;
        rate: number;
        taxId?: number;
        taxAmount: number;
        totalAmount: number;
    }[] = [];

    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, organizationId: data.organizationId },
      });

      if (!product) {
        throw new AppError(`Product not found: ${item.productId}`, 404);
      }

      const quantity = Number(item.quantity);
      const rate = Number(item.rate);
      let taxAmount = 0;
      let taxId = item.taxId;

      // Use product tax if not provided
      if (!taxId && product.taxId) {
        taxId = product.taxId;
      }

      if (taxId) {
        const tax = await prisma.tax.findFirst({
          where: { id: taxId, organizationId: data.organizationId },
        });

        if (tax) {
          taxAmount = (quantity * rate * Number(tax.rate)) / 100;
        }
      }

      const itemTotal = (quantity * rate) + taxAmount;
      subtotal += (quantity * rate);
      totalTax += taxAmount;

      processedItems.push({
        productId: item.productId,
        quantity,
        unit: product.unit,
        rate,
        taxId,
        taxAmount,
        totalAmount: itemTotal,
      });
    }

    const discountAmount = Number(purchaseData.discountAmount || 0);
    const adjustmentAmount = Number(purchaseData.adjustmentAmount || 0);
    const totalAmount = subtotal + totalTax - discountAmount + adjustmentAmount;

    // Create purchase in transaction
    const purchase = await prisma.$transaction(async (tx) => {
      // Create purchase record
      const newPurchase = await tx.purchase.create({
        data: {
          organizationId: data.organizationId,
          vendorId: data.vendorId,
          purchaseNumber: await this.generatePurchaseNumber(data.organizationId),
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          referenceNumber: data.referenceNumber,
          status: data.status || 'DRAFT',
          subtotal,
          taxAmount: totalTax,
          discountAmount,
          adjustmentAmount,
          totalAmount,
          balanceDue: totalAmount, // Assuming unpaid initially
          notes: data.notes,
          items: {
            create: processedItems,
          },
        },
        include: {
          items: true,
        },
      });

      // If status is RECEIVED, increase stock
      if (newPurchase.status === 'RECEIVED') {
        for (const item of newPurchase.items) {
          await this.adjustStockForPurchaseItem(tx, item, 1);
        }
      }

      return newPurchase;
    });

    logger.info(`Purchase created: ${purchase.id}`);
    return purchase;
  }

  /**
   * Update purchase status
   */
  async updatePurchaseStatus(organizationId: string, id: number, status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED') {
    const purchase = await prisma.purchase.findFirst({
      where: { id, organizationId },
      include: { items: true },
    });

    if (!purchase) {
      throw new AppError('Purchase not found', 404);
    }

    if (purchase.status === status) {
      return purchase;
    }

    // Handle stock changes based on status transition
    await prisma.$transaction(async (tx) => {
      // If moving TO RECEIVED from non-RECEIVED state -> Increase stock
      if (status === 'RECEIVED' && purchase.status !== 'RECEIVED') {
        for (const item of purchase.items) {
          await this.adjustStockForPurchaseItem(tx, item, 1);
        }
      }

      // If moving FROM RECEIVED to non-RECEIVED state (e.g. CANCELLED or back to DRAFT) -> Decrease stock (Revert)
      if (purchase.status === 'RECEIVED' && status !== 'RECEIVED') {
        for (const item of purchase.items) {
          await this.adjustStockForPurchaseItem(tx, item, -1);
        }
      }

      await tx.purchase.update({
        where: { id },
        data: { status },
      });
    });

    return this.getPurchaseById(organizationId, id);
  }

  /**
   * Helper to adjust stock
   */
  private async adjustStockForPurchaseItem(tx: any, item: any, multiplier: number) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
    });

    if (product && product.trackInventory) {
      const quantityChange = Number(item.quantity) * multiplier;
      const newStock = product.stockQuantity + quantityChange;

      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: newStock },
      });

      await tx.inventoryLog.create({
        data: {
          productId: item.productId,
          transactionType: 'PURCHASE',
          quantityChange: quantityChange,
          previousStock: product.stockQuantity,
          newStock,
          notes: `Purchase transaction ${item.purchaseId}`,
          referenceType: 'PURCHASE',
          referenceId: item.purchaseId,
        },
      });
    }
  }

  /**
   * Generate next purchase number
   */
  private async generatePurchaseNumber(organizationId: string) {
    const count = await prisma.purchase.count({
      where: { organizationId },
    });
    return `PUR-${String(count + 1).padStart(5, '0')}`;
  }

  /**
   * Get all purchases
   */
  async getAllPurchases(filters: PurchaseListFilters) {
    const {
      organizationId,
      search,
      vendorId,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { organizationId };

    if (vendorId) where.vendorId = vendorId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.purchaseDate = {};
      if (dateFrom) where.purchaseDate.gte = dateFrom;
      if (dateTo) where.purchaseDate.lte = dateTo;
    }

    if (search) {
      where.OR = [
        { purchaseNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { vendor: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { purchaseDate: 'desc' },
        include: {
          vendor: { select: { id: true, name: true } },
        },
      }),
      prisma.purchase.count({ where }),
    ]);

    return {
      data: purchases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get purchase by ID
   */
  async getPurchaseById(organizationId: string, id: number) {
    const purchase = await prisma.purchase.findFirst({
      where: { id, organizationId },
      include: {
        vendor: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            tax: { select: { id: true, name: true, rate: true } },
          },
        },
      },
    });

    if (!purchase) {
      throw new AppError('Purchase not found', 404);
    }

    return purchase;
  }
}

export default new PurchaseService();
