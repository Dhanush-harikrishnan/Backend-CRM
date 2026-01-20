import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';
import organizationService from './organization.service';
import customerService from './customer.service';

export interface InvoiceItemInput {
  productId?: number | string; // Accept both number and MongoDB ObjectId string
  itemType?: 'GOODS' | 'SERVICE';
  name?: string; // Made optional - will be looked up from product if not provided
  description?: string;
  hsnCode?: string;
  sacCode?: string;
  quantity: number;
  unit?: string;
  rate?: number; // Made optional - frontend may send 'price' instead
  price?: number; // Alias for rate from frontend
  taxRate?: number; // Accept taxRate from frontend
  discountType?: 'FIXED' | 'PERCENTAGE';
  discountValue?: number;
  taxId?: number | string;
}

export interface CreateInvoiceInput {
  organizationId: string;
  customerId?: number | string | null; // Accept both number and MongoDB ObjectId string
  customerName?: string; // For walk-in customers
  customerPhone?: string;
  customerEmail?: string;
  estimateId?: number | string;
  referenceNumber?: string;
  orderNumber?: string;
  invoiceDate?: Date | string; // Accept string dates too
  dueDate?: Date | string; // Accept string dates too
  placeOfSupply?: string;
  items: InvoiceItemInput[];
  subtotal?: number; // Accept frontend calculated values
  taxableAmount?: number;
  totalAmount?: number;
  discountType?: 'FIXED' | 'PERCENTAGE';
  discountValue?: number;
  discount?: number; // Alias from frontend
  shippingCharge?: number;
  shipping?: number; // Alias from frontend
  adjustmentAmount?: number;
  adjustmentDesc?: string;
  customerNotes?: string;
  termsConditions?: string;
  privateNotes?: string;
  status?: 'DRAFT' | 'SENT' | 'PENDING'; // Added PENDING for frontend
}

export interface UpdateInvoiceInput extends Partial<Omit<CreateInvoiceInput, 'organizationId'>> { }

export interface InvoiceListFilters {
  organizationId: string;
  customerId?: number;
  status?: string;
  paymentStatus?: string;
  dateFrom?: Date;
  dateTo?: Date;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  overdue?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'invoiceDate' | 'dueDate' | 'totalAmount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

class InvoiceService {
  /**
   * Calculate item amounts with GST breakdown
   */
  private calculateItemAmounts(
    item: InvoiceItemInput,
    isInterState: boolean,
    tax?: { rate: number; cgstRate: number | null; sgstRate: number | null; igstRate: number | null; cessRate: number | null }
  ) {
    const quantity = Number(item.quantity);
    // Use rate or price (frontend sends 'price')
    const rate = Number(item.rate ?? item.price ?? 0);
    const lineAmount = quantity * rate;

    // Calculate discount
    let discountAmount = 0;
    if (item.discountValue) {
      if (item.discountType === 'PERCENTAGE') {
        discountAmount = (lineAmount * Number(item.discountValue)) / 100;
      } else {
        discountAmount = Number(item.discountValue);
      }
    }

    const taxableAmount = lineAmount - discountAmount;

    // Calculate GST
    let cgstRate = 0, cgstAmount = 0;
    let sgstRate = 0, sgstAmount = 0;
    let igstRate = 0, igstAmount = 0;
    let cessRate = 0, cessAmount = 0;

    if (tax) {
      cessRate = Number(tax.cessRate || 0);
      cessAmount = (taxableAmount * cessRate) / 100;

      if (isInterState) {
        // Inter-state: Apply IGST
        igstRate = Number(tax.igstRate || tax.rate);
        igstAmount = (taxableAmount * igstRate) / 100;
      } else {
        // Intra-state: Apply CGST + SGST
        cgstRate = Number(tax.cgstRate || tax.rate / 2);
        sgstRate = Number(tax.sgstRate || tax.rate / 2);
        cgstAmount = (taxableAmount * cgstRate) / 100;
        sgstAmount = (taxableAmount * sgstRate) / 100;
      }
    }

    const totalTax = cgstAmount + sgstAmount + igstAmount + cessAmount;
    const totalAmount = taxableAmount + totalTax;

    return {
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      cgstRate,
      cgstAmount: Math.round(cgstAmount * 100) / 100,
      sgstRate,
      sgstAmount: Math.round(sgstAmount * 100) / 100,
      igstRate,
      igstAmount: Math.round(igstAmount * 100) / 100,
      cessRate,
      cessAmount: Math.round(cessAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }

  /**
   * Create a new invoice
   */
  async createInvoice(data: CreateInvoiceInput) {
    const { organizationId, customerId, customerName, customerPhone, customerEmail, items, ...invoiceData } = data;

    // Helper to parse various date formats
    const parseDate = (dateInput: Date | string | undefined): Date | undefined => {
      if (!dateInput) return undefined;
      if (dateInput instanceof Date) return dateInput;
      if (typeof dateInput === 'string') {
        // Try DD-MM-YYYY format first (frontend format)
        const ddmmyyyy = dateInput.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (ddmmyyyy) {
          return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
        }
        // Try ISO format or any other parseable format
        const parsed = new Date(dateInput);
        return isNaN(parsed.getTime()) ? undefined : parsed;
      }
      return undefined;
    };

    // Normalize status (PENDING -> DRAFT for frontend compatibility)
    const normalizedStatus = invoiceData.status === 'PENDING' ? 'DRAFT' : (invoiceData.status || 'DRAFT');

    // Validate customer if provided (skip validation for walk-in/cash sales)
    let customer = null;
    if (customerId && typeof customerId === 'number') {
      customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }
    }

    // Get organization
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    // Determine if inter-state (for GST calculation)
    const placeOfSupply = data.placeOfSupply || customer?.placeOfSupply || org.state;
    const isInterState = placeOfSupply !== org.state;

    // Generate invoice number
    const invoiceNumber = await organizationService.getNextSequenceNumber(organizationId, 'invoice');

    // Parse and calculate dates
    const invoiceDate = parseDate(data.invoiceDate) || new Date();
    const defaultPaymentTerms = customer?.paymentTerms || org.defaultPaymentTerms || 30;
    const dueDate = parseDate(data.dueDate) || new Date(invoiceDate.getTime() + defaultPaymentTerms * 24 * 60 * 60 * 1000);

    // Fetch products and taxes
    const productIds = items.filter(i => i.productId).map(i => i.productId) as number[];
    const products = productIds.length > 0
      ? await prisma.product.findMany({
        where: { id: { in: productIds }, organizationId, isActive: true },
        include: { tax: true },
      })
      : [];
    const productMap = new Map(products.map(p => [p.id, p]));

    // Validate stock for goods
    for (const item of items) {
      if (item.productId) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new AppError(`Product with ID ${item.productId} not found`, 404);
        }
        if (product.type === 'GOODS' && product.trackInventory && product.stockQuantity < item.quantity) {
          throw new AppError(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`, 400);
        }
      }
    }

    // Calculate item amounts
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalCess = 0;

    const invoiceItems = items.map((item, index) => {
      const product = item.productId ? productMap.get(item.productId) : null;
      const tax = product?.tax || null;

      const amounts = this.calculateItemAmounts(item, isInterState, tax ? {
        rate: Number(tax.rate),
        cgstRate: tax.cgstRate ? Number(tax.cgstRate) : null,
        sgstRate: tax.sgstRate ? Number(tax.sgstRate) : null,
        igstRate: tax.igstRate ? Number(tax.igstRate) : null,
        cessRate: tax.cessRate ? Number(tax.cessRate) : null,
      } : undefined);

      subtotal += amounts.taxableAmount;
      totalCgst += amounts.cgstAmount;
      totalSgst += amounts.sgstAmount;
      totalIgst += amounts.igstAmount;
      totalCess += amounts.cessAmount;

      return {
        productId: item.productId,
        itemType: item.itemType || product?.type || 'GOODS',
        name: item.name || product?.name || '',
        description: item.description || product?.description,
        hsnCode: item.hsnCode || product?.hsnCode,
        sacCode: item.sacCode || product?.sacCode,
        quantity: item.quantity,
        unit: item.unit || product?.unit || 'PCS',
        rate: item.rate ?? item.price ?? 0,
        discountType: item.discountType || 'FIXED',
        discountValue: item.discountValue || 0,
        discountAmount: amounts.discountAmount,
        taxableAmount: amounts.taxableAmount,
        cgstRate: amounts.cgstRate,
        cgstAmount: amounts.cgstAmount,
        sgstRate: amounts.sgstRate,
        sgstAmount: amounts.sgstAmount,
        igstRate: amounts.igstRate,
        igstAmount: amounts.igstAmount,
        cessRate: amounts.cessRate,
        cessAmount: amounts.cessAmount,
        totalAmount: amounts.totalAmount,
        sortOrder: index,
      };
    });

    // Calculate invoice-level discount
    let invoiceDiscountAmount = 0;
    if (invoiceData.discountValue) {
      if (invoiceData.discountType === 'PERCENTAGE') {
        invoiceDiscountAmount = (subtotal * Number(invoiceData.discountValue)) / 100;
      } else {
        invoiceDiscountAmount = Number(invoiceData.discountValue);
      }
    }

    const taxableAmount = subtotal - invoiceDiscountAmount;
    const totalTax = totalCgst + totalSgst + totalIgst + totalCess;
    const shippingCharge = Number(invoiceData.shippingCharge || invoiceData.shipping || 0);
    const adjustmentAmount = Number(invoiceData.adjustmentAmount || 0);

    // Round off to nearest rupee (optional)
    const totalBeforeRound = taxableAmount + totalTax + shippingCharge + adjustmentAmount;
    const roundOff = Math.round(totalBeforeRound) - totalBeforeRound;
    const totalAmount = Math.round(totalBeforeRound);

    // Create invoice with items in transaction
    const invoice = await prisma.$transaction(async (tx) => {
      // Build create data - customerId is optional for walk-in customers
      const createData: Record<string, unknown> = {
        organizationId,
        invoiceNumber,
        referenceNumber: invoiceData.referenceNumber,
        orderNumber: invoiceData.orderNumber,
        invoiceDate,
        dueDate,
        placeOfSupply,
        isInterState,
        subtotal,
        discountType: invoiceData.discountType || 'FIXED',
        discountValue: invoiceData.discountValue || 0,
        discountAmount: invoiceDiscountAmount,
        taxableAmount,
        cgstAmount: totalCgst,
        sgstAmount: totalSgst,
        igstAmount: totalIgst,
        cessAmount: totalCess,
        totalTax,
        shippingCharge,
        adjustmentAmount,
        adjustmentDesc: invoiceData.adjustmentDesc,
        roundOff,
        totalAmount,
        balanceDue: totalAmount,
        status: normalizedStatus,
        paymentStatus: 'UNPAID',
        customerNotes: invoiceData.customerNotes || org.defaultInvoiceNotes,
        termsConditions: invoiceData.termsConditions || org.defaultTermsConditions,
        privateNotes: invoiceData.privateNotes,
        estimateId: invoiceData.estimateId,
      };

      // Add customer info - either existing customer or walk-in details
      if (customerId) {
        createData.customerId = customerId;
      } else {
        createData.customerName = customerName || 'Walk-in Customer';
        createData.customerPhone = customerPhone;
        createData.customerEmail = customerEmail;
      }

      const inv = await tx.invoice.create({
        data: {
          ...createData,
          items: {
            create: invoiceItems,
          },
        } as any,
        include: {
          customer: {
            select: { id: true, displayName: true, email: true, mobile: true },
          },
          items: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      // Decrement stock for goods
      for (const item of items) {
        if (item.productId) {
          const product = productMap.get(item.productId);
          if (product && product.type === 'GOODS' && product.trackInventory) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stockQuantity: { decrement: item.quantity },
              },
            });

            await tx.inventoryLog.create({
              data: {
                productId: item.productId,
                transactionType: 'SALE',
                quantityChange: -item.quantity,
                previousStock: product.stockQuantity,
                newStock: product.stockQuantity - item.quantity,
                referenceType: 'INVOICE',
                referenceId: inv.id,
                notes: `Sale via Invoice ${inv.invoiceNumber}`,
              },
            });
          }
        }
      }

      // Update customer balance only if customer exists
      if (customerId) {
        await customerService.updateCustomerBalance(customerId);
      }

      return inv;
    });

    logger.info(`Invoice created: ${invoice.invoiceNumber}`);
    return invoice;
  }

  /**
   * Get all invoices with filtering
   */
  async getAllInvoices(filters: InvoiceListFilters) {
    const {
      organizationId,
      customerId,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
      dueDateFrom,
      dueDateTo,
      overdue,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: any = { organizationId };

    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    if (dateFrom || dateTo) {
      where.invoiceDate = {};
      if (dateFrom) where.invoiceDate.gte = dateFrom;
      if (dateTo) where.invoiceDate.lte = dateTo;
    }

    if (dueDateFrom || dueDateTo) {
      where.dueDate = {};
      if (dueDateFrom) where.dueDate.gte = dueDateFrom;
      if (dueDateTo) where.dueDate.lte = dueDateTo;
    }

    if (overdue) {
      where.dueDate = { lt: new Date() };
      where.paymentStatus = { in: ['UNPAID', 'PARTIALLY_PAID'] };
      where.status = { notIn: ['VOID', 'DRAFT'] };
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { displayName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: { id: true, displayName: true, email: true },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(organizationId: string, id: number) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        creditNotes: {
          where: { status: { not: 'VOID' } },
        },
        estimate: {
          select: { id: true, estimateNumber: true },
        },
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    return invoice;
  }

  /**
   * Update invoice (only if DRAFT)
   */
  async updateInvoice(organizationId: string, id: number, data: UpdateInvoiceInput) {
    const existing = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { items: true },
    });

    if (!existing) {
      throw new AppError('Invoice not found', 404);
    }

    if (existing.status !== 'DRAFT') {
      throw new AppError('Only draft invoices can be edited', 400);
    }

    // If items are being updated, handle full recalculation
    if (data.items) {
      // Restore previous stock
      const oldProductIds = existing.items.filter(i => i.productId).map(i => i.productId) as number[];
      if (oldProductIds.length > 0) {
        const oldProducts = await prisma.product.findMany({
          where: { id: { in: oldProductIds } },
        });

        await prisma.$transaction(async (tx) => {
          for (const item of existing.items) {
            if (item.productId) {
              const product = oldProducts.find(p => p.id === item.productId);
              if (product && product.trackInventory) {
                await tx.product.update({
                  where: { id: item.productId },
                  data: { stockQuantity: { increment: Number(item.quantity) } },
                });
              }
            }
          }

          // Delete old items
          await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        });
      }

      // Delete and recreate is simpler for full update
      await prisma.invoice.delete({ where: { id } });

      return this.createInvoice({
        organizationId,
        customerId: data.customerId || existing.customerId,
        items: data.items,
        ...data,
      });
    }

    // Simple update without items
    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        customerId: data.customerId ?? undefined,
        referenceNumber: data.referenceNumber,
        orderNumber: data.orderNumber,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        customerNotes: data.customerNotes,
        termsConditions: data.termsConditions,
        privateNotes: data.privateNotes,
      },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return invoice;
  }

  /**
   * Update invoice status
   */
  async updateStatus(organizationId: string, id: number, status: 'SENT' | 'VIEWED' | 'VOID') {
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (invoice.status === 'VOID') {
      throw new AppError('Cannot update voided invoice', 400);
    }

    // If voiding, restore stock and update customer balance
    if (status === 'VOID') {
      if (invoice.paymentStatus !== 'UNPAID') {
        throw new AppError('Cannot void an invoice with payments. Create a credit note instead.', 400);
      }

      await prisma.$transaction(async (tx) => {
        const items = await tx.invoiceItem.findMany({
          where: { invoiceId: id },
          include: { product: true },
        });

        // Restore stock
        for (const item of items) {
          if (item.productId && item.product?.trackInventory) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: Number(item.quantity) } },
            });

            await tx.inventoryLog.create({
              data: {
                productId: item.productId,
                transactionType: 'ADJUSTMENT',
                quantityChange: Number(item.quantity),
                previousStock: item.product.stockQuantity,
                newStock: item.product.stockQuantity + Number(item.quantity),
                referenceType: 'INVOICE',
                referenceId: id,
                notes: `Voided Invoice ${invoice.invoiceNumber}`,
              },
            });
          }
        }

        await tx.invoice.update({
          where: { id },
          data: { status: 'VOID', balanceDue: 0 },
        });
      });

      await customerService.updateCustomerBalance(invoice.customerId);

      logger.info(`Invoice voided: ${invoice.invoiceNumber}`);
      return { message: 'Invoice voided successfully' };
    }

    return prisma.invoice.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Record payment for invoice (Cash, UPI, Card, etc.)
   */
  async recordCashPayment(organizationId: string, invoiceId: number, data: {
    amount: number;
    paymentDate?: Date;
    paymentMode?: 'CASH' | 'UPI' | 'CARD' | 'NETBANKING' | 'CHEQUE' | 'BANK_TRANSFER';
    referenceNumber?: string;
    notes?: string;
  }) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (invoice.status === 'VOID') {
      throw new AppError('Cannot record payment for voided invoice', 400);
    }

    if (invoice.paymentStatus === 'PAID') {
      throw new AppError('Invoice is already fully paid', 400);
    }

    const amount = Number(data.amount);
    const balanceDue = Number(invoice.balanceDue);

    if (amount <= 0) {
      throw new AppError('Payment amount must be positive', 400);
    }

    if (amount > balanceDue) {
      throw new AppError(`Payment amount exceeds balance due (₹${balanceDue})`, 400);
    }

    const paymentNumber = await organizationService.getNextSequenceNumber(organizationId, 'payment');

    const result = await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          organizationId,
          customerId: invoice.customerId,
          invoiceId,
          paymentNumber,
          paymentDate: data.paymentDate || new Date(),
          amount,
          paymentMode: data.paymentMode || 'CASH',
          referenceNumber: data.referenceNumber,
          notes: data.notes,
        },
      });

      // Update invoice
      const newBalanceDue = balanceDue - amount;
      const paymentStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      const invoiceStatus = newBalanceDue <= 0 ? 'PAID' : invoice.status;

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          balanceDue: newBalanceDue,
          paymentStatus,
          status: invoiceStatus === 'DRAFT' ? 'SENT' : invoiceStatus,
        },
      });

      return payment;
    });

    // Update customer balance
    await customerService.updateCustomerBalance(invoice.customerId);

    logger.info(`Payment recorded: ${result.paymentNumber} for invoice ${invoice.invoiceNumber}`);

    return result;
  }

  /**
   * Get invoice payments
   */
  async getInvoicePayments(organizationId: string, invoiceId: number) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    return prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paymentDate: 'desc' },
    });
  }

  /**
   * Delete invoice (only if DRAFT)
   */
  async deleteInvoice(organizationId: string, id: number) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { items: true },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (invoice.status !== 'DRAFT') {
      throw new AppError('Only draft invoices can be deleted', 400);
    }

    // Restore stock
    await prisma.$transaction(async (tx) => {
      for (const item of invoice.items) {
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product && product.trackInventory) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: Number(item.quantity) } },
            });
          }
        }
      }

      await tx.invoice.delete({ where: { id } });
    });

    logger.info(`Invoice deleted: ${id}`);
    return { message: 'Invoice deleted successfully' };
  }

  /**
   * Duplicate invoice
   */
  async duplicateInvoice(organizationId: string, id: number) {
    const original = await this.getInvoiceById(organizationId, id);

    const items = original.items.map(item => ({
      productId: item.productId || undefined,
      itemType: item.itemType,
      name: item.name,
      description: item.description || undefined,
      hsnCode: item.hsnCode || undefined,
      sacCode: item.sacCode || undefined,
      quantity: Number(item.quantity),
      unit: item.unit,
      rate: Number(item.rate),
      discountType: item.discountType,
      discountValue: Number(item.discountValue),
    }));

    return this.createInvoice({
      organizationId,
      customerId: original.customerId,
      items,
      discountType: original.discountType,
      discountValue: Number(original.discountValue),
      shippingCharge: Number(original.shippingCharge),
      adjustmentAmount: Number(original.adjustmentAmount),
      adjustmentDesc: original.adjustmentDesc || undefined,
      customerNotes: original.customerNotes || undefined,
      termsConditions: original.termsConditions || undefined,
    });
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(organizationId: string) {
    return prisma.invoice.findMany({
      where: {
        organizationId,
        dueDate: { lt: new Date() },
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        status: { notIn: ['VOID', 'DRAFT'] },
      },
      include: {
        customer: {
          select: { id: true, displayName: true, email: true, mobile: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Get invoice summary for dashboard
   */
  async getInvoiceSummary(organizationId: string, dateRange?: { from: Date; to: Date }) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const from = dateRange?.from || startOfMonth;
    const to = dateRange?.to || endOfMonth;

    const [
      totalInvoiced,
      totalReceived,
      totalOverdue,
      statusCounts,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          organizationId,
          invoiceDate: { gte: from, lte: to },
          status: { notIn: ['VOID', 'DRAFT'] },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: {
          organizationId,
          paymentDate: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId,
          dueDate: { lt: now },
          paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
          status: { notIn: ['VOID', 'DRAFT'] },
        },
        _sum: { balanceDue: true },
        _count: true,
      }),
      prisma.invoice.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),
    ]);

    return {
      period: { from, to },
      totalInvoiced: Number(totalInvoiced._sum.totalAmount || 0),
      invoiceCount: totalInvoiced._count,
      totalReceived: Number(totalReceived._sum.amount || 0),
      totalOverdue: Number(totalOverdue._sum.balanceDue || 0),
      overdueCount: totalOverdue._count,
      statusBreakdown: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

export default new InvoiceService();
