import prisma from '../config/database';
import { Prisma, InvoiceStatus, PaymentStatus } from '@prisma/client';

export interface ReportFilters {
  organizationId: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  customerId?: number;
  productId?: number;
}

class ReportService {
  /**
   * Helper to get date range
   */
  private getDateRange(dateRange?: { from: Date; to: Date }, defaultDays = 30) {
    if (dateRange) return dateRange;

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - defaultDays);
    return { from, to };
  }

  /**
   * Get current month date range
   */
  private getCurrentMonthRange() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from, to };
  }

  /**
   * Get financial year range (April to March for India)
   */
  private getFinancialYearRange(fyStartMonth = 4) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let fyStart: Date;
    let fyEnd: Date;

    if (currentMonth >= fyStartMonth) {
      fyStart = new Date(currentYear, fyStartMonth - 1, 1);
      fyEnd = new Date(currentYear + 1, fyStartMonth - 1, 0);
    } else {
      fyStart = new Date(currentYear - 1, fyStartMonth - 1, 1);
      fyEnd = new Date(currentYear, fyStartMonth - 1, 0);
    }

    return { from: fyStart, to: fyEnd };
  }

  /**
   * Dashboard Overview
   */
  async getDashboardOverview(organizationId: string) {
    const monthRange = this.getCurrentMonthRange();
    const fyRange = this.getFinancialYearRange();

    const validStatuses: InvoiceStatus[] = ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];
    const unpaidStatuses: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID'];

    const [
      monthlyInvoices,
      yearlyInvoices,
      unpaidInvoices,
      overdueInvoices,
      recentInvoices,
      recentPayments,
      monthlyExpenses,
      yearlyExpenses,
    ] = await Promise.all([
      // Monthly invoices total
      prisma.invoice.aggregate({
        where: {
          organizationId,
          invoiceDate: { gte: monthRange.from, lte: monthRange.to },
          status: { in: validStatuses },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Yearly invoices total
      prisma.invoice.aggregate({
        where: {
          organizationId,
          invoiceDate: { gte: fyRange.from, lte: fyRange.to },
          status: { in: validStatuses },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Unpaid invoices
      prisma.invoice.aggregate({
        where: {
          organizationId,
          paymentStatus: { in: unpaidStatuses },
          status: { in: validStatuses },
        },
        _sum: { balanceDue: true },
        _count: true,
      }),
      // Overdue invoices
      prisma.invoice.count({
        where: {
          organizationId,
          dueDate: { lt: new Date() },
          paymentStatus: { in: unpaidStatuses },
          status: { in: validStatuses },
        },
      }),
      // Recent invoices
      prisma.invoice.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          paymentStatus: true,
          invoiceDate: true,
          customer: { select: { displayName: true } },
        },
      }),
      // Recent payments
      prisma.payment.findMany({
        where: { organizationId },
        orderBy: { paymentDate: 'desc' },
        take: 5,
        select: {
          id: true,
          paymentNumber: true,
          amount: true,
          paymentDate: true,
          customer: { select: { displayName: true } },
        },
      }),
      // Monthly expenses
      prisma.expense.aggregate({
        where: {
          organizationId,
          expenseDate: { gte: monthRange.from, lte: monthRange.to },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Yearly expenses
      prisma.expense.aggregate({
        where: {
          organizationId,
          expenseDate: { gte: fyRange.from, lte: fyRange.to },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      period: {
        month: monthRange,
        financialYear: fyRange,
      },
      revenue: {
        monthlyTotal: Number(monthlyInvoices._sum?.totalAmount || 0),
        monthlyCount: monthlyInvoices._count,
        yearlyTotal: Number(yearlyInvoices._sum?.totalAmount || 0),
        yearlyCount: yearlyInvoices._count,
      },
      receivables: {
        totalUnpaid: Number(unpaidInvoices._sum?.balanceDue || 0),
        unpaidCount: unpaidInvoices._count,
        overdueCount: overdueInvoices,
      },
      expenses: {
        monthlyTotal: Number(monthlyExpenses._sum?.amount || 0),
        monthlyCount: monthlyExpenses._count,
        yearlyTotal: Number(yearlyExpenses._sum?.amount || 0),
        yearlyCount: yearlyExpenses._count,
      },
      profitThisMonth: Number(monthlyInvoices._sum?.totalAmount || 0) - Number(monthlyExpenses._sum?.amount || 0),
      recentInvoices,
      recentPayments,
    };
  }

  /**
   * Sales Report
   */
  async getSalesReport(filters: ReportFilters) {
    const { organizationId, dateRange } = filters;
    const range = this.getDateRange(dateRange, 30);
    const validStatuses: InvoiceStatus[] = ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      invoiceDate: { gte: range.from, lte: range.to },
      status: { in: validStatuses },
    };

    const [totals, byCustomer, topProducts, invoicesByStatus] = await Promise.all([
      // Totals
      prisma.invoice.aggregate({
        where,
        _sum: {
          totalAmount: true,
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          cessAmount: true,
          discountAmount: true,
        },
        _count: true,
        _avg: { totalAmount: true },
      }),
      // By customer
      prisma.invoice.groupBy({
        by: ['customerId'],
        where,
        _sum: { totalAmount: true },
        _count: true,
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
      // Top products
      prisma.invoiceItem.groupBy({
        by: ['productId'],
        where: { invoice: where },
        _sum: { totalAmount: true, quantity: true },
        _count: true,
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
      // By payment status
      prisma.invoice.groupBy({
        by: ['paymentStatus'],
        where,
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    // Get customer and product names
    const customerIds = byCustomer.map(c => c.customerId).filter((id): id is number => id !== null);
    const productIds = topProducts.map(p => p.productId).filter((id): id is number => id !== null);

    const [customers, products] = await Promise.all([
      prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, displayName: true },
      }),
      productIds.length > 0
        ? prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const customerMap = new Map(customers.map(c => [c.id, c.displayName]));
    const productMap = new Map(products.map(p => [p.id, p.name]));

    return {
      period: range,
      summary: {
        totalSales: Number(totals._sum?.totalAmount || 0),
        taxableAmount: Number(totals._sum?.taxableAmount || 0),
        totalTax: Number((totals._sum?.cgstAmount || 0)) +
                  Number((totals._sum?.sgstAmount || 0)) +
                  Number((totals._sum?.igstAmount || 0)) +
                  Number((totals._sum?.cessAmount || 0)),
        discountGiven: Number(totals._sum?.discountAmount || 0),
        invoiceCount: totals._count,
        avgInvoiceValue: Number(totals._avg?.totalAmount || 0),
      },
      topCustomers: byCustomer.filter(c => c.customerId !== null).map(c => ({
        customerId: c.customerId,
        customerName: customerMap.get(c.customerId!) || 'Unknown',
        amount: Number(c._sum?.totalAmount || 0),
        invoiceCount: c._count,
      })),
      topProducts: topProducts.map(p => ({
        productId: p.productId,
        productName: p.productId ? productMap.get(p.productId) || 'Unknown' : 'Custom Item',
        amount: Number(p._sum?.totalAmount || 0),
        quantity: Number(p._sum?.quantity || 0),
        count: p._count,
      })),
      byPaymentStatus: invoicesByStatus.map(s => ({
        status: s.paymentStatus,
        amount: Number(s._sum?.totalAmount || 0),
        count: s._count,
      })),
    };
  }

  /**
   * Tax Report (GST Summary)
   */
  async getTaxReport(filters: ReportFilters) {
    const { organizationId, dateRange } = filters;
    const range = this.getDateRange(dateRange, 30);
    const validStatuses: InvoiceStatus[] = ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      invoiceDate: { gte: range.from, lte: range.to },
      status: { in: validStatuses },
    };

    const [outputTax, inputTax, byRate] = await Promise.all([
      // Output tax (from sales)
      prisma.invoice.aggregate({
        where,
        _sum: {
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          cessAmount: true,
        },
      }),
      // Input tax (from expenses) - simplified since Expense doesn't have detailed GST fields
      prisma.expense.aggregate({
        where: {
          organizationId,
          expenseDate: { gte: range.from, lte: range.to },
        },
        _sum: {
          amount: true,
          taxAmount: true,
        },
      }),
      // Tax by rate
      prisma.invoiceItem.groupBy({
        by: ['cgstRate', 'sgstRate', 'igstRate'],
        where: { invoice: where },
        _sum: {
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          cessAmount: true,
        },
      }),
    ]);

    const outputCgst = Number(outputTax._sum?.cgstAmount || 0);
    const outputSgst = Number(outputTax._sum?.sgstAmount || 0);
    const outputIgst = Number(outputTax._sum?.igstAmount || 0);
    const outputCess = Number(outputTax._sum?.cessAmount || 0);
    const totalOutput = outputCgst + outputSgst + outputIgst + outputCess;

    // For input tax, we only have the aggregate taxAmount from expenses
    const totalInput = Number(inputTax._sum?.taxAmount || 0);

    return {
      period: range,
      outputTax: {
        taxableAmount: Number(outputTax._sum?.taxableAmount || 0),
        cgst: outputCgst,
        sgst: outputSgst,
        igst: outputIgst,
        cess: outputCess,
        total: totalOutput,
      },
      inputTax: {
        totalExpense: Number(inputTax._sum?.amount || 0),
        taxAmount: totalInput,
      },
      netTaxLiability: totalOutput - totalInput,
      byRate: byRate.map(item => ({
        cgstRate: Number(item.cgstRate || 0),
        sgstRate: Number(item.sgstRate || 0),
        igstRate: Number(item.igstRate || 0),
        taxableAmount: Number(item._sum?.taxableAmount || 0),
        cgst: Number(item._sum?.cgstAmount || 0),
        sgst: Number(item._sum?.sgstAmount || 0),
        igst: Number(item._sum?.igstAmount || 0),
        cess: Number(item._sum?.cessAmount || 0),
      })),
    };
  }

  /**
   * Receivables Aging Report
   */
  async getReceivablesAgingReport(organizationId: string) {
    const today = new Date();
    const validStatuses: InvoiceStatus[] = ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'];
    const unpaidStatuses: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID'];

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: validStatuses },
        paymentStatus: { in: unpaidStatuses },
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        dueDate: true,
        totalAmount: true,
        balanceDue: true,
        customer: { select: { displayName: true } },
      },
    });

    // Categorize by age
    const current: typeof invoices = [];
    const days1to30: typeof invoices = [];
    const days31to60: typeof invoices = [];
    const days61to90: typeof invoices = [];
    const over90: typeof invoices = [];

    invoices.forEach(inv => {
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysOverdue <= 0) current.push(inv);
      else if (daysOverdue <= 30) days1to30.push(inv);
      else if (daysOverdue <= 60) days31to60.push(inv);
      else if (daysOverdue <= 90) days61to90.push(inv);
      else over90.push(inv);
    });

    const sumBalanceDue = (arr: typeof invoices) =>
      arr.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);

    return {
      summary: {
        current: { count: current.length, amount: sumBalanceDue(current) },
        days1to30: { count: days1to30.length, amount: sumBalanceDue(days1to30) },
        days31to60: { count: days31to60.length, amount: sumBalanceDue(days31to60) },
        days61to90: { count: days61to90.length, amount: sumBalanceDue(days61to90) },
        over90: { count: over90.length, amount: sumBalanceDue(over90) },
        total: {
          count: invoices.length,
          amount: sumBalanceDue(invoices),
        },
      },
      details: {
        current,
        days1to30,
        days31to60,
        days61to90,
        over90,
      },
    };
  }

  /**
   * Customer Statement Report
   */
  async getCustomerStatementReport(
    organizationId: string,
    customerId: number,
    dateRange?: { from: Date; to: Date }
  ) {
    const range = this.getDateRange(dateRange, 365);

    const [customer, invoices, payments, creditNotes] = await Promise.all([
      prisma.customer.findFirst({
        where: { id: customerId, organizationId },
        select: {
          id: true,
          displayName: true,
          companyName: true,
          email: true,
          phone: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId,
          customerId,
          invoiceDate: { gte: range.from, lte: range.to },
        },
        orderBy: { invoiceDate: 'asc' },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          totalAmount: true,
          balanceDue: true,
          paymentStatus: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          organizationId,
          customerId,
          paymentDate: { gte: range.from, lte: range.to },
        },
        orderBy: { paymentDate: 'asc' },
        select: {
          id: true,
          paymentNumber: true,
          paymentDate: true,
          amount: true,
          invoice: { select: { invoiceNumber: true } },
        },
      }),
      prisma.creditNote.findMany({
        where: {
          organizationId,
          customerId,
          creditNoteDate: { gte: range.from, lte: range.to },
        },
        orderBy: { creditNoteDate: 'asc' },
        select: {
          id: true,
          creditNoteNumber: true,
          creditNoteDate: true,
          totalAmount: true,
          status: true,
        },
      }),
    ]);

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Build statement
    const transactions: {
      date: Date;
      type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE';
      reference: string;
      debit: number;
      credit: number;
      balance: number;
    }[] = [];

    let runningBalance = 0;

    // Combine all transactions and sort by date
    const allTransactions = [
      ...invoices.map(inv => ({
        date: inv.invoiceDate,
        type: 'INVOICE' as const,
        reference: inv.invoiceNumber,
        amount: Number(inv.totalAmount),
        isDebit: true,
      })),
      ...payments.map(pay => ({
        date: pay.paymentDate,
        type: 'PAYMENT' as const,
        reference: pay.paymentNumber,
        amount: Number(pay.amount),
        isDebit: false,
      })),
      ...creditNotes.map(cn => ({
        date: cn.creditNoteDate,
        type: 'CREDIT_NOTE' as const,
        reference: cn.creditNoteNumber,
        amount: Number(cn.totalAmount),
        isDebit: false,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const txn of allTransactions) {
      if (txn.isDebit) {
        runningBalance += txn.amount;
      } else {
        runningBalance -= txn.amount;
      }

      transactions.push({
        date: txn.date,
        type: txn.type,
        reference: txn.reference,
        debit: txn.isDebit ? txn.amount : 0,
        credit: txn.isDebit ? 0 : txn.amount,
        balance: runningBalance,
      });
    }

    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalPaid = payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
    const totalCredits = creditNotes.reduce((sum, cn) => sum + Number(cn.totalAmount), 0);

    return {
      customer,
      period: range,
      summary: {
        totalInvoiced,
        totalPaid,
        totalCredits,
        balanceDue: totalInvoiced - totalPaid - totalCredits,
      },
      transactions,
    };
  }

  /**
   * Expense Report
   */
  async getExpenseReport(filters: ReportFilters) {
    const { organizationId, dateRange } = filters;
    const range = this.getDateRange(dateRange, 30);

    const [summary, byCategory, byPaymentMode, topVendors] = await Promise.all([
      // Summary
      prisma.expense.aggregate({
        where: {
          organizationId,
          expenseDate: { gte: range.from, lte: range.to },
        },
        _sum: { amount: true, taxAmount: true },
        _count: true,
        _avg: { amount: true },
      }),
      // By category
      prisma.expense.groupBy({
        by: ['categoryId'],
        where: {
          organizationId,
          expenseDate: { gte: range.from, lte: range.to },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
      // By payment mode
      prisma.expense.groupBy({
        by: ['paymentMode'],
        where: {
          organizationId,
          expenseDate: { gte: range.from, lte: range.to },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Top vendors
      prisma.expense.groupBy({
        by: ['vendorName'],
        where: {
          organizationId,
          expenseDate: { gte: range.from, lte: range.to },
          vendorName: { not: null },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
    ]);

    // Get category names
    const categoryIds = byCategory.map(c => c.categoryId).filter((id): id is number => id !== null);
    const categories = categoryIds.length > 0
      ? await prisma.expenseCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];

    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    return {
      period: range,
      summary: {
        totalExpense: Number(summary._sum?.amount || 0),
        totalTax: Number(summary._sum?.taxAmount || 0),
        count: summary._count,
        avgExpense: Number(summary._avg?.amount || 0),
      },
      byCategory: byCategory.map(c => ({
        categoryId: c.categoryId,
        categoryName: c.categoryId ? categoryMap.get(c.categoryId) || 'Uncategorized' : 'Uncategorized',
        totalExpense: Number(c._sum?.amount || 0),
        count: c._count,
      })),
      byPaymentMode: byPaymentMode.map(p => ({
        paymentMode: p.paymentMode,
        totalExpense: Number(p._sum?.amount || 0),
        count: p._count,
      })),
      topVendors: topVendors.map(v => ({
        vendorName: v.vendorName || 'Unknown',
        totalExpense: Number(v._sum?.amount || 0),
        count: v._count,
      })),
    };
  }

  /**
   * Profit & Loss Summary
   */
  async getProfitLossSummary(filters: ReportFilters) {
    const { organizationId, dateRange } = filters;
    const range = this.getDateRange(dateRange, 30);
    const validStatuses: InvoiceStatus[] = ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];

    const [revenue, expenses] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          organizationId,
          invoiceDate: { gte: range.from, lte: range.to },
          status: { in: validStatuses },
        },
        _sum: {
          totalAmount: true,
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          discountAmount: true,
        },
      }),
      prisma.expense.aggregate({
        where: {
          organizationId,
          expenseDate: { gte: range.from, lte: range.to },
        },
        _sum: { amount: true, taxAmount: true },
      }),
    ]);

    const totalRevenue = Number(revenue._sum?.totalAmount || 0);
    const totalExpenses = Number(expenses._sum?.amount || 0);
    const grossProfit = totalRevenue - totalExpenses;
    const taxCollected = Number((revenue._sum?.cgstAmount || 0)) +
                         Number((revenue._sum?.sgstAmount || 0)) +
                         Number((revenue._sum?.igstAmount || 0));
    const taxPaid = Number(expenses._sum?.taxAmount || 0);

    return {
      period: range,
      revenue: {
        gross: Number(revenue._sum?.taxableAmount || 0),
        taxCollected,
        discounts: Number(revenue._sum?.discountAmount || 0),
        total: totalRevenue,
      },
      expenses: {
        total: totalExpenses,
        taxPaid,
      },
      netTax: taxCollected - taxPaid,
      grossProfit,
      profitMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    };
  }

  /**
   * Product Sales Report
   */
  async getProductSalesReport(filters: ReportFilters) {
    const { organizationId, dateRange, productId } = filters;
    const range = this.getDateRange(dateRange, 30);
    const validStatuses: InvoiceStatus[] = ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];

    const where: Prisma.InvoiceItemWhereInput = {
      invoice: {
        organizationId,
        invoiceDate: { gte: range.from, lte: range.to },
        status: { in: validStatuses },
      },
    };

    if (productId) {
      where.productId = productId;
    }

    const [productSales, monthlySales] = await Promise.all([
      prisma.invoiceItem.groupBy({
        by: ['productId'],
        where,
        _sum: {
          quantity: true,
          totalAmount: true,
          taxableAmount: true,
        },
        _count: true,
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 20,
      }),
      // Monthly trend - get all items and aggregate manually
      prisma.invoiceItem.findMany({
        where,
        select: {
          quantity: true,
          totalAmount: true,
          invoice: { select: { invoiceDate: true } },
        },
      }),
    ]);

    // Get product names
    const prodIds = productSales.map(p => p.productId).filter((id): id is number => id !== null);
    const products = prodIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: prodIds } },
          select: { id: true, name: true, sku: true },
        })
      : [];

    const productMap = new Map(products.map(p => [p.id, p]));

    // Calculate monthly aggregates
    const monthlyData = new Map<string, { quantity: number; amount: number }>();
    monthlySales.forEach(item => {
      const monthKey = `${item.invoice.invoiceDate.getFullYear()}-${String(item.invoice.invoiceDate.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyData.get(monthKey) || { quantity: 0, amount: 0 };
      monthlyData.set(monthKey, {
        quantity: existing.quantity + Number(item.quantity),
        amount: existing.amount + Number(item.totalAmount),
      });
    });

    return {
      period: range,
      products: productSales.map(p => {
        const product = p.productId ? productMap.get(p.productId) : null;
        return {
          productId: p.productId,
          productName: product?.name || 'Custom Item',
          sku: product?.sku || '',
          quantitySold: Number(p._sum?.quantity || 0),
          revenue: Number(p._sum?.totalAmount || 0),
          taxableAmount: Number(p._sum?.taxableAmount || 0),
          invoiceCount: p._count,
        };
      }),
      monthlyTrend: Array.from(monthlyData.entries())
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };
  }
}

export default new ReportService();
