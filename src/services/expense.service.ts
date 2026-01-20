import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';
import { Prisma } from '@prisma/client';

// Default expense categories for new organizations
const DEFAULT_CATEGORIES = [
  { name: 'Office Supplies', description: 'Stationery, printer ink, etc.' },
  { name: 'Travel', description: 'Transportation, accommodation, etc.' },
  { name: 'Utilities', description: 'Electricity, water, internet, etc.' },
  { name: 'Rent', description: 'Office or warehouse rent' },
  { name: 'Salaries & Wages', description: 'Employee salaries and wages' },
  { name: 'Professional Services', description: 'Legal, accounting, consulting, etc.' },
  { name: 'Marketing & Advertising', description: 'Ads, promotions, etc.' },
  { name: 'Insurance', description: 'Business insurance premiums' },
  { name: 'Bank Charges', description: 'Bank fees, transaction charges, etc.' },
  { name: 'Meals & Entertainment', description: 'Client meetings, team meals, etc.' },
  { name: 'Equipment & Maintenance', description: 'Equipment purchases and repairs' },
  { name: 'Miscellaneous', description: 'Other expenses' },
];

export interface CreateExpenseInput {
  organizationId: string;
  categoryId?: number;
  vendorName?: string;
  expenseDate?: Date;
  amount: number;
  isTaxInclusive?: boolean;
  taxAmount?: number;
  paymentMode?: 'CASH' | 'UPI' | 'CARD' | 'NETBANKING' | 'CHEQUE' | 'BANK_TRANSFER';
  bankAccountId?: number;
  referenceNumber?: string;
  notes?: string;
  attachments?: any[];
  isBillable?: boolean;
}

export interface UpdateExpenseInput extends Partial<Omit<CreateExpenseInput, 'organizationId'>> { }

export interface ExpenseListFilters {
  organizationId: string;
  categoryId?: number;
  vendorName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  paymentMode?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'expenseDate' | 'amount' | 'vendorName' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

class ExpenseService {
  /**
   * Create default expense categories for a new organization
   */
  async createDefaultCategories(organizationId: string) {
    const categories = DEFAULT_CATEGORIES.map(cat => ({
      organizationId,
      name: cat.name,
      description: cat.description,
    }));

    await prisma.expenseCategory.createMany({
      data: categories,
      skipDuplicates: true,
    });

    logger.info(`Created default expense categories for organization: ${organizationId}`);
  }

  /**
   * Get expense categories
   */
  async getCategories(organizationId: string) {
    return prisma.expenseCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create expense category
   */
  async createCategory(organizationId: string, data: { name: string; description?: string }) {
    // Check for duplicate
    const existing = await prisma.expenseCategory.findFirst({
      where: { organizationId, name: data.name },
    });

    if (existing) {
      throw new AppError('Category with this name already exists', 400);
    }

    return prisma.expenseCategory.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
      },
    });
  }

  /**
   * Update expense category
   */
  async updateCategory(organizationId: string, id: number, data: { name?: string; description?: string; isActive?: boolean }) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id, organizationId },
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    return prisma.expenseCategory.update({
      where: { id },
      data,
    });
  }

  /**
   * Create expense
   */
  async createExpense(data: CreateExpenseInput) {
    const { organizationId, ...expenseData } = data;

    const expense = await prisma.expense.create({
      data: {
        organizationId,
        categoryId: expenseData.categoryId,
        vendorName: expenseData.vendorName,
        expenseDate: expenseData.expenseDate || new Date(),
        amount: expenseData.amount,
        isTaxInclusive: expenseData.isTaxInclusive ?? true,
        taxAmount: expenseData.taxAmount || 0,
        paymentMode: expenseData.paymentMode || 'CASH',
        bankAccountId: expenseData.bankAccountId,
        referenceNumber: expenseData.referenceNumber,
        notes: expenseData.notes,
        attachments: expenseData.attachments || [],
        isBillable: expenseData.isBillable || false,
      },
      include: {
        category: true,
        bankAccount: true,
      },
    });

    logger.info(`Expense created: ${expense.id} for ${expense.amount}`);
    return expense;
  }

  /**
   * Get all expenses with filtering
   */
  async getAllExpenses(filters: ExpenseListFilters) {
    const {
      organizationId,
      categoryId,
      vendorName,
      dateFrom,
      dateTo,
      paymentMode,
      search,
      page = 1,
      limit = 20,
      sortBy = 'expenseDate',
      sortOrder = 'desc',
    } = filters;

    const where: Prisma.ExpenseWhereInput = { organizationId };

    if (categoryId) where.categoryId = categoryId;
    if (vendorName) where.vendorName = { contains: vendorName, mode: 'insensitive' };
    if (paymentMode) where.paymentMode = paymentMode as any;

    if (dateFrom || dateTo) {
      where.expenseDate = {};
      if (dateFrom) where.expenseDate.gte = dateFrom;
      if (dateTo) where.expenseDate.lte = dateTo;
    }

    if (search) {
      where.OR = [
        { vendorName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: true,
          bankAccount: true,
        },
      }),
      prisma.expense.count({ where }),
    ]);

    return {
      data: expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get expense by ID
   */
  async getExpenseById(organizationId: string, id: number) {
    const expense = await prisma.expense.findFirst({
      where: { id, organizationId },
      include: {
        category: true,
        bankAccount: true,
      },
    });

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    return expense;
  }

  /**
   * Update expense
   */
  async updateExpense(organizationId: string, id: number, data: UpdateExpenseInput) {
    const existing = await prisma.expense.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new AppError('Expense not found', 404);
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        vendorName: data.vendorName,
        expenseDate: data.expenseDate,
        amount: data.amount,
        isTaxInclusive: data.isTaxInclusive,
        taxAmount: data.taxAmount,
        paymentMode: data.paymentMode,
        bankAccountId: data.bankAccountId,
        referenceNumber: data.referenceNumber,
        notes: data.notes,
        attachments: data.attachments,
        isBillable: data.isBillable,
      },
      include: {
        category: true,
        bankAccount: true,
      },
    });

    logger.info(`Expense updated: ${expense.id}`);
    return expense;
  }

  /**
   * Delete expense
   */
  async deleteExpense(organizationId: string, id: number) {
    const expense = await prisma.expense.findFirst({
      where: { id, organizationId },
    });

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    await prisma.expense.delete({ where: { id } });

    logger.info(`Expense deleted: ${id}`);
    return { message: 'Expense deleted successfully' };
  }

  /**
   * Get expense summary
   */
  async getExpenseSummary(organizationId: string, dateRange?: { from: Date; to: Date }) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get all-time totals AND this month's totals
    const [allTimeTotal, thisMonthTotal, byCategory, byPaymentMode] = await Promise.all([
      // All-time total expenses
      prisma.expense.aggregate({
        where: {
          organizationId,
        },
        _sum: { amount: true, taxAmount: true },
        _count: true,
        _avg: { amount: true },
      }),
      // This month's expenses
      prisma.expense.aggregate({
        where: {
          organizationId,
          expenseDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Category breakdown (use dateRange if provided, otherwise all-time)
      prisma.expense.groupBy({
        by: ['categoryId'],
        where: {
          organizationId,
          ...(dateRange ? { expenseDate: { gte: dateRange.from, lte: dateRange.to } } : {}),
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Payment mode breakdown (use dateRange if provided, otherwise all-time)
      prisma.expense.groupBy({
        by: ['paymentMode'],
        where: {
          organizationId,
          ...(dateRange ? { expenseDate: { gte: dateRange.from, lte: dateRange.to } } : {}),
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Get category names
    const categoryIds = byCategory.map(c => c.categoryId).filter(Boolean) as number[];
    const categories = categoryIds.length > 0
      ? await prisma.expenseCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
      : [];

    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    return {
      // Fields expected by frontend
      totalExpenses: Number(allTimeTotal._sum?.amount || 0),
      thisMonth: Number(thisMonthTotal._sum?.amount || 0),
      count: allTimeTotal._count,
      // Additional detailed fields
      period: { from: startOfMonth, to: endOfMonth },
      totalTax: Number(allTimeTotal._sum?.taxAmount || 0),
      avgExpense: Number(allTimeTotal._avg?.amount || 0),
      byCategory: byCategory.map(c => ({
        categoryId: c.categoryId,
        categoryName: c.categoryId ? categoryMap.get(c.categoryId) || 'Uncategorized' : 'Uncategorized',
        total: Number(c._sum?.amount || 0),
        count: c._count,
      })),
      byPaymentMode: byPaymentMode.map(p => ({
        paymentMode: p.paymentMode,
        total: Number(p._sum?.amount || 0),
        count: p._count,
      })),
    };
  }


  /**
   * Get recent expenses
   */
  async getRecentExpenses(organizationId: string, limit = 10) {
    return prisma.expense.findMany({
      where: { organizationId },
      orderBy: { expenseDate: 'desc' },
      take: limit,
      include: {
        category: true,
      },
    });
  }
}

export default new ExpenseService();
