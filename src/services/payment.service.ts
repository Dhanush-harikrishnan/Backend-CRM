import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';
import organizationService from './organization.service';
import customerService from './customer.service';

export interface CreatePaymentInput {
  organizationId: string;
  customerId: number;
  invoiceId?: number;
  amount: number;
  paymentDate?: Date;
  paymentMode?: 'CASH' | 'UPI' | 'CARD' | 'NETBANKING' | 'CHEQUE' | 'BANK_TRANSFER';
  bankAccountId?: number;
  referenceNumber?: string;
  notes?: string;
}

export interface UpdatePaymentInput {
  paymentDate?: Date;
  referenceNumber?: string;
  notes?: string;
}

export interface PaymentListFilters {
  organizationId: string;
  customerId?: number;
  invoiceId?: number;
  paymentMode?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'paymentDate' | 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ApplyPaymentInput {
  organizationId: string;
  paymentId: number;
  applications: Array<{
    invoiceId: number;
    amount: number;
  }>;
}

class PaymentService {
  /**
   * Create payment received
   */
  async createPayment(data: CreatePaymentInput) {
    const { organizationId, customerId, invoiceId, amount, ...paymentData } = data;

    // Validate customer
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Validate invoice if provided
    if (invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId, customerId },
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

      const balanceDue = Number(invoice.balanceDue);
      if (amount > balanceDue) {
        throw new AppError(`Payment amount exceeds invoice balance (₹${balanceDue})`, 400);
      }
    }

    if (amount <= 0) {
      throw new AppError('Payment amount must be positive', 400);
    }

    // Generate payment number
    const paymentNumber = await organizationService.getNextSequenceNumber(organizationId, 'payment');

    const payment = await prisma.$transaction(async (tx) => {
      // Create payment record
      const pmt = await tx.payment.create({
        data: {
          organizationId,
          customerId,
          invoiceId,
          paymentNumber,
          paymentDate: paymentData.paymentDate || new Date(),
          amount,
          paymentMode: 'CASH', // Only CASH for now
          bankAccountId: paymentData.bankAccountId,
          referenceNumber: paymentData.referenceNumber,
          notes: paymentData.notes,
        },
        include: {
          customer: {
            select: { id: true, displayName: true },
          },
          invoice: {
            select: { id: true, invoiceNumber: true },
          },
        },
      });

      // Update invoice if linked
      if (invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (invoice) {
          const newBalanceDue = Number(invoice.balanceDue) - amount;
          const paymentStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
          
          await tx.invoice.update({
            where: { id: invoiceId },
            data: {
              balanceDue: Math.max(0, newBalanceDue),
              paymentStatus,
              status: invoice.status === 'DRAFT' ? 'SENT' : invoice.status,
            },
          });
        }
      }

      return pmt;
    });

    // Update customer balance
    await customerService.updateCustomerBalance(customerId);

    logger.info(`Payment created: ${payment.paymentNumber}`);
    return payment;
  }

  /**
   * Get all payments with filtering
   */
  async getAllPayments(filters: PaymentListFilters) {
    const {
      organizationId,
      customerId,
      invoiceId,
      paymentMode,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 20,
      sortBy = 'paymentDate',
      sortOrder = 'desc',
    } = filters;

    const where: any = { organizationId };

    if (customerId) where.customerId = customerId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (paymentMode) where.paymentMode = paymentMode;

    if (dateFrom || dateTo) {
      where.paymentDate = {};
      if (dateFrom) where.paymentDate.gte = dateFrom;
      if (dateTo) where.paymentDate.lte = dateTo;
    }

    if (search) {
      where.OR = [
        { paymentNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { displayName: { contains: search, mode: 'insensitive' } } },
        { invoice: { invoiceNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: { id: true, displayName: true, email: true },
          },
          invoice: {
            select: { id: true, invoiceNumber: true, totalAmount: true },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(organizationId: string, id: number) {
    const payment = await prisma.payment.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        invoice: true,
        bankAccount: true,
      },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    return payment;
  }

  /**
   * Update payment (limited fields)
   */
  async updatePayment(organizationId: string, id: number, data: UpdatePaymentInput) {
    const payment = await prisma.payment.findFirst({
      where: { id, organizationId },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    // Only allow updating certain fields
    return prisma.payment.update({
      where: { id },
      data: {
        paymentDate: data.paymentDate,
        referenceNumber: data.referenceNumber,
        notes: data.notes,
      },
      include: {
        customer: {
          select: { id: true, displayName: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true },
        },
      },
    });
  }

  /**
   * Delete payment
   */
  async deletePayment(organizationId: string, id: number) {
    const payment = await prisma.payment.findFirst({
      where: { id, organizationId },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      // If linked to invoice, restore balance
      if (payment.invoiceId) {
        const invoice = await tx.invoice.findUnique({
          where: { id: payment.invoiceId },
        });

        if (invoice && invoice.status !== 'VOID') {
          const newBalanceDue = Number(invoice.balanceDue) + Number(payment.amount);
          const paymentStatus = newBalanceDue >= Number(invoice.totalAmount) ? 'UNPAID' : 'PARTIALLY_PAID';

          await tx.invoice.update({
            where: { id: payment.invoiceId },
            data: {
              balanceDue: newBalanceDue,
              paymentStatus,
            },
          });
        }
      }

      await tx.payment.delete({ where: { id } });
    });

    // Update customer balance
    await customerService.updateCustomerBalance(payment.customerId);

    logger.info(`Payment deleted: ${payment.paymentNumber}`);
    return { message: 'Payment deleted successfully' };
  }

  /**
   * Get unpaid/partially paid invoices for a customer
   */
  async getUnpaidInvoices(organizationId: string, customerId: number) {
    return prisma.invoice.findMany({
      where: {
        organizationId,
        customerId,
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        status: { notIn: ['VOID', 'DRAFT'] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        totalAmount: true,
        balanceDue: true,
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Record bulk payment (apply to multiple invoices)
   */
  async recordBulkPayment(data: {
    organizationId: string;
    customerId: number;
    totalAmount: number;
    paymentDate?: Date;
    referenceNumber?: string;
    notes?: string;
    invoiceAllocations: Array<{ invoiceId: number; amount: number }>;
  }) {
    const { organizationId, customerId, totalAmount, invoiceAllocations, ...paymentData } = data;

    // Validate customer
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Validate total matches allocations
    const allocatedTotal = invoiceAllocations.reduce((sum, a) => sum + a.amount, 0);
    if (Math.abs(allocatedTotal - totalAmount) > 0.01) {
      throw new AppError('Total amount does not match invoice allocations', 400);
    }

    // Validate all invoices
    const invoiceIds = invoiceAllocations.map(a => a.invoiceId);
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        organizationId,
        customerId,
        status: { notIn: ['VOID'] },
      },
    });

    if (invoices.length !== invoiceIds.length) {
      throw new AppError('One or more invoices not found', 404);
    }

    // Validate amounts don't exceed balance
    for (const allocation of invoiceAllocations) {
      const invoice = invoices.find(i => i.id === allocation.invoiceId);
      if (!invoice) continue;
      if (allocation.amount > Number(invoice.balanceDue)) {
        throw new AppError(`Amount exceeds balance for invoice ${invoice.invoiceNumber}`, 400);
      }
    }

    // Generate payment number
    const paymentNumber = await organizationService.getNextSequenceNumber(organizationId, 'payment');

    const result = await prisma.$transaction(async (tx) => {
      // Create one master payment record (without specific invoice link)
      const payment = await tx.payment.create({
        data: {
          organizationId,
          customerId,
          paymentNumber,
          paymentDate: paymentData.paymentDate || new Date(),
          amount: totalAmount,
          paymentMode: 'CASH',
          referenceNumber: paymentData.referenceNumber,
          notes: paymentData.notes || `Applied to invoices: ${invoices.map(i => i.invoiceNumber).join(', ')}`,
        },
      });

      // Update each invoice
      for (const allocation of invoiceAllocations) {
        const invoice = invoices.find(i => i.id === allocation.invoiceId)!;
        const newBalanceDue = Number(invoice.balanceDue) - allocation.amount;
        const paymentStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

        // Create linked payment record for tracking
        const individualPaymentNumber = await organizationService.getNextSequenceNumber(organizationId, 'payment');
        await tx.payment.create({
          data: {
            organizationId,
            customerId,
            invoiceId: allocation.invoiceId,
            paymentNumber: individualPaymentNumber,
            paymentDate: paymentData.paymentDate || new Date(),
            amount: allocation.amount,
            paymentMode: 'CASH',
            referenceNumber: `Ref: ${payment.paymentNumber}`,
            notes: `Part of bulk payment ${payment.paymentNumber}`,
          },
        });

        await tx.invoice.update({
          where: { id: allocation.invoiceId },
          data: {
            balanceDue: Math.max(0, newBalanceDue),
            paymentStatus,
          },
        });
      }

      return payment;
    });

    // Update customer balance
    await customerService.updateCustomerBalance(customerId);

    logger.info(`Bulk payment recorded: ${result.paymentNumber}`);
    return result;
  }

  /**
   * Get payment summary
   */
  async getPaymentSummary(organizationId: string, dateRange?: { from: Date; to: Date }) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const from = dateRange?.from || startOfMonth;
    const to = dateRange?.to || endOfMonth;

    const [totalReceived, byMode, recentPayments] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          organizationId,
          paymentDate: { gte: from, lte: to },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.groupBy({
        by: ['paymentMode'],
        where: {
          organizationId,
          paymentDate: { gte: from, lte: to },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where: { organizationId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { displayName: true },
          },
        },
      }),
    ]);

    return {
      period: { from, to },
      totalReceived: Number(totalReceived._sum.amount || 0),
      paymentCount: totalReceived._count,
      byMode: byMode.map(item => ({
        mode: item.paymentMode,
        amount: Number(item._sum.amount || 0),
        count: item._count,
      })),
      recentPayments,
    };
  }

  /**
   * Get customer payments
   */
  async getCustomerPayments(organizationId: string, customerId: number) {
    return prisma.payment.findMany({
      where: { organizationId, customerId },
      orderBy: { paymentDate: 'desc' },
      include: {
        invoice: {
          select: { id: true, invoiceNumber: true },
        },
      },
    });
  }

  /**
   * Get recent payments
   */
  async getRecentPayments(organizationId: string, limit: number = 10) {
    return prisma.payment.findMany({
      where: { organizationId },
      take: limit,
      orderBy: { paymentDate: 'desc' },
      include: {
        customer: {
          select: { id: true, displayName: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true },
        },
      },
    });
  }
}

export default new PaymentService();
