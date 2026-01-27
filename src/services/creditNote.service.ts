import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';
import organizationService from './organization.service';

export interface CreditNoteItemInput {
  productId?: number;
  itemType?: 'GOODS' | 'SERVICE' | 'BUNDLE';
  name: string;
  description?: string;
  hsnCode?: string;
  sacCode?: string;
  quantity: number;
  unit?: string;
  rate: number;
  taxId?: number;
}

export interface CreateCreditNoteInput {
  organizationId: string;
  customerId?: number;
  invoiceId?: number;
  referenceNumber?: string;
  creditNoteDate?: Date;
  reason?: 'RETURN' | 'DISCOUNT' | 'QUALITY_ISSUE' | 'PRICING_ERROR' | 'DUPLICATE' | 'ORDER_CANCELLATION' | 'OTHER';
  placeOfSupply?: string;
  items: CreditNoteItemInput[];
  customerNotes?: string;
  privateNotes?: string;
}

export interface CreditNoteListFilters {
  organizationId: string;
  customerId?: number;
  invoiceId?: number;
  status?: string;
  reason?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'creditNoteDate' | 'creditNoteNumber' | 'totalAmount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

class CreditNoteService {
  /**
   * Calculate item amounts with GST breakdown
   */
  private calculateItemAmounts(
    item: CreditNoteItemInput,
    isInterState: boolean,
    tax?: { rate: number; cgstRate: number | null; sgstRate: number | null; igstRate: number | null; cessRate: number | null }
  ) {
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    const taxableAmount = quantity * rate;

    // Calculate GST
    let cgstRate = 0, cgstAmount = 0;
    let sgstRate = 0, sgstAmount = 0;
    let igstRate = 0, igstAmount = 0;
    let cessRate = 0, cessAmount = 0;

    if (tax) {
      cessRate = Number(tax.cessRate || 0);
      cessAmount = (taxableAmount * cessRate) / 100;

      if (isInterState) {
        igstRate = Number(tax.igstRate || tax.rate);
        igstAmount = (taxableAmount * igstRate) / 100;
      } else {
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
   * Create a new credit note
   */
  async createCreditNote(data: CreateCreditNoteInput) {
    const { organizationId, customerId, invoiceId, items, ...creditNoteData } = data;

    // Validate customer
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Validate invoice if provided
    let invoice = null;
    if (invoiceId) {
      invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId, customerId },
      });

      if (!invoice) {
        throw new AppError('Invoice not found or does not belong to this customer', 404);
      }
    }

    // Get organization for state comparison
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    // Determine if inter-state
    const placeOfSupply = data.placeOfSupply || customer.placeOfSupply || invoice?.placeOfSupply || org.state;
    const isInterState = placeOfSupply !== org.state;

    // Generate credit note number
    const creditNoteNumber = await organizationService.getNextSequenceNumber(organizationId, 'creditNote');

    // Fetch products and taxes
    const productIds = items.filter(i => i.productId).map(i => i.productId) as number[];
    const products = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, organizationId },
          include: { tax: true },
        })
      : [];
    const productMap = new Map(products.map(p => [p.id, p]));

    // Calculate item amounts
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalCess = 0;

    const creditNoteItems = items.map((item, index) => {
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
        rate: item.rate,
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

    const totalTax = totalCgst + totalSgst + totalIgst + totalCess;
    const totalAmount = subtotal + totalTax;

    // Create credit note with items in transaction
    const creditNote = await prisma.$transaction(async (tx) => {
      const cn = await tx.creditNote.create({
        data: {
          organizationId,
          customerId,
          invoiceId,
          creditNoteNumber,
          referenceNumber: creditNoteData.referenceNumber,
          creditNoteDate: creditNoteData.creditNoteDate || new Date(),
          reason: creditNoteData.reason || 'RETURN',
          placeOfSupply,
          isInterState,
          subtotal,
          taxableAmount: subtotal,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          cessAmount: totalCess,
          totalTax,
          totalAmount,
          balanceAmount: totalAmount,
          customerNotes: creditNoteData.customerNotes,
          privateNotes: creditNoteData.privateNotes,
          status: 'DRAFT',
          items: {
            create: creditNoteItems,
          },
        },
        include: {
          customer: {
            select: { id: true, displayName: true, email: true },
          },
          invoice: {
            select: { id: true, invoiceNumber: true },
          },
          items: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      // If reason is RETURN and items have products, restore inventory
      if (creditNoteData.reason === 'RETURN') {
        for (const item of creditNoteItems) {
          if (item.productId) {
            const product = productMap.get(item.productId);
            if (product && product.trackInventory) {
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  stockQuantity: { increment: Number(item.quantity) },
                },
              });

              await tx.inventoryLog.create({
                data: {
                  productId: item.productId,
                  transactionType: 'RETURN',
                  quantityChange: Number(item.quantity),
                  previousStock: product.stockQuantity,
                  newStock: product.stockQuantity + Number(item.quantity),
                  referenceType: 'CREDIT_NOTE',
                  referenceId: cn.id,
                  notes: `Return via Credit Note ${cn.creditNoteNumber}`,
                },
              });
            }
          }
        }
      }

      return cn;
    });

    logger.info(`Credit note created: ${creditNote.creditNoteNumber}`);
    return creditNote;
  }

  /**
   * Get all credit notes with filtering
   */
  async getAllCreditNotes(filters: CreditNoteListFilters) {
    const {
      organizationId,
      customerId,
      invoiceId,
      status,
      reason,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { organizationId };

    if (customerId) where.customerId = customerId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (status) where.status = status;
    if (reason) where.reason = reason;

    if (dateFrom || dateTo) {
      where.creditNoteDate = {};
      if (dateFrom) where.creditNoteDate.gte = dateFrom;
      if (dateTo) where.creditNoteDate.lte = dateTo;
    }

    if (search) {
      where.OR = [
        { creditNoteNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { displayName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [creditNotes, total] = await Promise.all([
      prisma.creditNote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, displayName: true },
          },
          invoice: {
            select: { id: true, invoiceNumber: true },
          },
        },
      }),
      prisma.creditNote.count({ where }),
    ]);

    return {
      data: creditNotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get credit note by ID
   */
  async getCreditNoteById(organizationId: string, id: number) {
    const creditNote = await prisma.creditNote.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        invoice: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    });

    if (!creditNote) {
      throw new AppError('Credit note not found', 404);
    }

    return creditNote;
  }

  /**
   * Update credit note status
   */
  async updateStatus(organizationId: string, id: number, status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'VOID') {
    const creditNote = await prisma.creditNote.findFirst({
      where: { id, organizationId },
    });

    if (!creditNote) {
      throw new AppError('Credit note not found', 404);
    }

    if (creditNote.status === 'VOID') {
      throw new AppError('Cannot update voided credit note', 400);
    }

    // If voiding, check if it has been applied to invoices
    if (status === 'VOID') {
      // In a real implementation, check if credits have been applied
      // For now, just void it
    }

    return prisma.creditNote.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Apply credit note to invoice
   */
  async applyToInvoice(organizationId: string, creditNoteId: number, invoiceId: number, amount?: number) {
    const [creditNote, invoice] = await Promise.all([
      prisma.creditNote.findFirst({
        where: { id: creditNoteId, organizationId },
      }),
      prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId },
      }),
    ]);

    if (!creditNote) {
      throw new AppError('Credit note not found', 404);
    }

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (creditNote.status !== 'OPEN') {
      throw new AppError('Credit note must be in OPEN status to apply', 400);
    }

    if (creditNote.customerId !== invoice.customerId) {
      throw new AppError('Credit note and invoice must belong to the same customer', 400);
    }

    const applyAmount = amount || Math.min(Number(creditNote.balanceAmount), Number(invoice.balanceDue));

    if (applyAmount <= 0) {
      throw new AppError('No amount to apply', 400);
    }

    if (applyAmount > Number(creditNote.balanceAmount)) {
      throw new AppError('Amount exceeds credit note balance', 400);
    }

    if (applyAmount > Number(invoice.balanceDue)) {
      throw new AppError('Amount exceeds invoice balance due', 400);
    }

    // Update both in transaction
    await prisma.$transaction(async (tx) => {
      const newCreditBalance = Number(creditNote.balanceAmount) - applyAmount;
      const newInvoiceBalance = Number(invoice.balanceDue) - applyAmount;

      await tx.creditNote.update({
        where: { id: creditNoteId },
        data: {
          balanceAmount: newCreditBalance,
          status: newCreditBalance <= 0 ? 'CLOSED' : 'OPEN',
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          balanceDue: newInvoiceBalance,
          paymentStatus: newInvoiceBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID',
          status: newInvoiceBalance <= 0 ? 'PAID' : invoice.status,
        },
      });

      // Create a payment record for the credit application
      const paymentNumber = await organizationService.getNextSequenceNumber(organizationId, 'payment');
      
      if (invoice.customerId) {
        await tx.payment.create({
          data: {
            organizationId,
            customerId: invoice.customerId,
            invoiceId,
            paymentNumber,
            paymentDate: new Date(),
            amount: applyAmount,
            paymentMode: 'CASH', // Credit note application
            notes: `Applied from Credit Note ${creditNote.creditNoteNumber}`,
          },
        });
      }
    });

    logger.info(`Credit note ${creditNote.creditNoteNumber} applied to invoice ${invoice.invoiceNumber}: ₹${applyAmount}`);

    return {
      message: 'Credit note applied successfully',
      appliedAmount: applyAmount,
    };
  }

  /**
   * Delete credit note (only if draft)
   */
  async deleteCreditNote(organizationId: string, id: number) {
    const creditNote = await prisma.creditNote.findFirst({
      where: { id, organizationId },
    });

    if (!creditNote) {
      throw new AppError('Credit note not found', 404);
    }

    if (creditNote.status !== 'DRAFT') {
      throw new AppError('Only draft credit notes can be deleted', 400);
    }

    await prisma.creditNote.delete({
      where: { id },
    });

    logger.info(`Credit note deleted: ${id}`);
    return { message: 'Credit note deleted successfully' };
  }

  /**
   * Create credit note from invoice (for returns)
   */
  async createFromInvoice(organizationId: string, invoiceId: number, itemsToReturn: { invoiceItemId: number; quantity: number }[]) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        items: true,
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    // Map invoice items for lookup
    const invoiceItemMap = new Map(invoice.items.map(item => [item.id, item]));

    // Build credit note items
    const creditNoteItems: CreditNoteItemInput[] = [];

    for (const returnItem of itemsToReturn) {
      const invoiceItem = invoiceItemMap.get(returnItem.invoiceItemId);
      if (!invoiceItem) {
        throw new AppError(`Invoice item ${returnItem.invoiceItemId} not found`, 404);
      }

      if (returnItem.quantity > Number(invoiceItem.quantity)) {
        throw new AppError(`Return quantity exceeds original quantity for ${invoiceItem.name}`, 400);
      }

      creditNoteItems.push({
        productId: invoiceItem.productId || undefined,
        itemType: invoiceItem.itemType,
        name: invoiceItem.name,
        description: invoiceItem.description || undefined,
        hsnCode: invoiceItem.hsnCode || undefined,
        sacCode: invoiceItem.sacCode || undefined,
        quantity: returnItem.quantity,
        unit: invoiceItem.unit,
        rate: Number(invoiceItem.rate),
      });
    }

    return this.createCreditNote({
      organizationId,
      customerId: invoice.customerId ?? undefined,
      invoiceId: invoice.id,
      reason: 'RETURN',
      placeOfSupply: invoice.placeOfSupply || undefined,
      items: creditNoteItems,
      customerNotes: `Return for Invoice ${invoice.invoiceNumber}`,
    });
  }
}

export default new CreditNoteService();
