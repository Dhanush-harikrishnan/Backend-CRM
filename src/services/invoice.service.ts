import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { CreateInvoiceInput } from '../validators';
import logger from '../config/logger';

export class InvoiceService {
  /**
   * Create Invoice with Transaction Logic
   * This ensures atomicity - either all operations succeed or all fail
   */
  async createInvoice(data: CreateInvoiceInput) {
    const { customerId, items, discount, paymentMode, paymentStatus, notes } = data;

    // Validate customer exists (except Guest customer which is seeded with ID 1)
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Use Prisma Transaction - Critical for data integrity
    const result = await prisma.$transaction(async (tx: any) => {
      // Step 1: Fetch all products and validate stock availability
      const productIds = items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new AppError('One or more products not found or inactive', 404);
      }

      // Create a map for quick product lookup
      type ProductWithStock = { id: number; name: string; price: any; taxRate: any; stockQuantity: number; };
      const productMap = new Map<number, ProductWithStock>(products.map((p: any) => [p.id, p]));

      // Step 2: Validate stock and calculate totals
      let subtotal = 0;
      let totalTaxAmount = 0;
      const invoiceItemsData = [];

      for (const item of items) {
        const product = productMap.get(item.productId) as ProductWithStock;
        if (!product) {
          throw new AppError(`Product with ID ${item.productId} not found`, 404);
        }

        // **CRITICAL: Check if sufficient stock is available**
        if (product.stockQuantity < item.quantity) {
          throw new AppError(
            `Insufficient stock for product "${product.name}". Available: ${product.stockQuantity}, Requested: ${item.quantity}`,
            400
          );
        }

        // Calculate line item values
        const unitPrice = Number(product.price);
        const lineSubtotal = unitPrice * item.quantity;
        const taxRate = Number(product.taxRate);
        const taxAmount = (lineSubtotal * taxRate) / 100;
        const lineTotal = lineSubtotal + taxAmount;

        subtotal += lineSubtotal;
        totalTaxAmount += taxAmount;

        invoiceItemsData.push({
          productId: product.id,
          productName: product.name, // Snapshot for historical data
          quantity: item.quantity,
          unitPrice,
          taxRate,
          taxAmount,
          lineTotal,
        });
      }

      // Calculate final total with discount
      const totalAmount = subtotal + totalTaxAmount - discount;

      if (totalAmount < 0) {
        throw new AppError('Total amount cannot be negative', 400);
      }

      // Step 3: Generate unique invoice number
      const invoiceNumber = await this.generateInvoiceNumber(tx);

      // Step 4: Create Invoice record
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId,
          subtotal,
          taxAmount: totalTaxAmount,
          discount,
          totalAmount,
          paymentMode,
          paymentStatus,
          notes,
        },
      });

      logger.info(`Invoice created: ${invoiceNumber} for customer ${customerId}`);

      // Step 5: Create Invoice Items
      await tx.invoiceItem.createMany({
        data: invoiceItemsData.map((itemData) => ({
          invoiceId: invoice.id,
          ...itemData,
        })),
      });

      // Step 6: Decrement stock quantities and create inventory logs
      for (const item of items) {
        const product = productMap.get(item.productId) as ProductWithStock;
        
        // Update product stock
        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });

        // Create inventory log for audit trail
        await tx.inventoryLog.create({
          data: {
            productId: product.id,
            transactionType: 'SALE',
            quantityChange: -item.quantity, // Negative for sale
            previousStock: product.stockQuantity,
            newStock: product.stockQuantity - item.quantity,
            referenceId: invoice.id,
            notes: `Sale via Invoice ${invoiceNumber}`,
          },
        });

        logger.debug(`Stock decremented for product ${product.id}: ${product.stockQuantity} -> ${product.stockQuantity - item.quantity}`);
      }

      // Return the invoice (already has all data from include)
      return invoice;
    });

    logger.info(`Invoice transaction completed successfully: ${result?.invoiceNumber}`);
    return result;
  }

  /**
   * Generate unique invoice number
   * Format: INV-YYYYMMDD-XXXX
   */
  private async generateInvoiceNumber(tx: any): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    
    // Get today's invoice count
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const todayInvoiceCount = await tx.invoice.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequenceNumber = (todayInvoiceCount + 1).toString().padStart(4, '0');
    return `INV-${dateStr}-${sequenceNumber}`;
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(id: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
            isGuest: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    return invoice;
  }

  /**
   * Get all invoices with filters
   */
  async getInvoices(filters: {
    startDate?: Date;
    endDate?: Date;
    customerId?: number;
    paymentMode?: string;
    page?: number;
    limit?: number;
  }) {
    const { startDate, endDate, customerId, paymentMode, page = 1, limit = 20 } = filters;

    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (paymentMode) {
      where.paymentMode = paymentMode;
    }

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              mobile: true,
              isGuest: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get sales summary
   */
  async getSalesSummary(startDate?: Date, endDate?: Date) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [totalSales, totalInvoices, paymentModeSummary] = await Promise.all([
      prisma.invoice.aggregate({
        where,
        _sum: { totalAmount: true },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.groupBy({
        by: ['paymentMode'],
        where,
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    return {
      totalSales: totalSales._sum.totalAmount || 0,
      totalInvoices,
      paymentModeSummary,
    };
  }
}

export default new InvoiceService();
