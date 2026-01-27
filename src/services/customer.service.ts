import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';

export interface CreateCustomerInput {
  organizationId: string;
  customerGroupId?: number;
  customerType?: 'INDIVIDUAL' | 'BUSINESS';
  displayName: string;
  companyName?: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  gstNumber?: string;
  gstTreatment?: 'REGISTERED_BUSINESS' | 'UNREGISTERED' | 'CONSUMER' | 'OVERSEAS' | 'SEZ' | 'DEEMED_EXPORT';
  panNumber?: string;
  placeOfSupply?: string;
  taxExempt?: boolean;
  taxExemptReason?: string;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  paymentTerms?: number;
  creditLimit?: number;
  notes?: string;
  openingBalance?: number;
  lifecycleStage?: 'LEAD' | 'PROSPECT' | 'CUSTOMER' | 'CHURNED';
  source?: 'WEBSITE' | 'REFERRAL' | 'ADVERTISEMENT' | 'COLD_CALL' | 'EVENT' | 'OTHER';
  assignedToUserId?: string;
  contacts?: {
    salutation?: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    designation?: string;
    department?: string;
    isPrimary?: boolean;
  }[];
}

export interface UpdateCustomerInput extends Partial<Omit<CreateCustomerInput, 'organizationId'>> {
  isActive?: boolean;
}

export interface CustomerListFilters {
  organizationId: string;
  search?: string;
  customerType?: 'INDIVIDUAL' | 'BUSINESS';
  customerGroupId?: number;
  gstTreatment?: string;
  hasOutstandingBalance?: boolean;
  isActive?: boolean;
  lifecycleStage?: string;
  assignedToUserId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'displayName' | 'createdAt' | 'currentBalance';
  sortOrder?: 'asc' | 'desc';
}

class CustomerService {
  /**
   * Create a new customer
   */
  async createCustomer(data: CreateCustomerInput) {
    const { contacts, ...customerData } = data;

    // Validate GST treatment based on GST number
    if (data.gstNumber && data.gstTreatment === 'UNREGISTERED') {
      throw new AppError('GST Treatment cannot be UNREGISTERED when GST Number is provided', 400);
    }

    // Auto-set GST treatment if GST number provided
    const gstTreatment = data.gstNumber 
      ? (data.gstTreatment || 'REGISTERED_BUSINESS')
      : (data.gstTreatment || 'UNREGISTERED');

    // Validate assigned user if provided
    if (data.assignedToUserId) {
      const assignedUser = await prisma.user.findFirst({
        where: { id: data.assignedToUserId, organizationId: data.organizationId },
      });
      if (!assignedUser) {
        throw new AppError('Assigned user not found in this organization', 400);
      }
    }

    // Create customer with contacts in transaction
    const customer = await prisma.$transaction(async (tx) => {
      const newCustomer = await tx.customer.create({
        data: {
          ...customerData,
          gstTreatment,
          currentBalance: data.openingBalance || 0,
        },
      });

      // Create contacts if provided
      if (contacts && contacts.length > 0) {
        await tx.customerContact.createMany({
          data: contacts.map((contact, index) => ({
            customerId: newCustomer.id,
            ...contact,
            isPrimary: contact.isPrimary ?? (index === 0),
          })),
        });
      }

      return newCustomer;
    });

    logger.info(`Customer created: ${customer.id} - ${customer.displayName}`);

    return this.getCustomerById(data.organizationId, customer.id);
  }

  /**
   * Get all customers with filtering and pagination
   */
  async getAllCustomers(filters: CustomerListFilters) {
    const {
      organizationId,
      search,
      customerType,
      customerGroupId,
      gstTreatment,
      hasOutstandingBalance,
      isActive = true,
      page = 1,
      limit = 20,
      sortBy = 'displayName',
      sortOrder = 'asc',
    } = filters;

    const where: any = {
      organizationId,
      isGuest: false,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (customerType) {
      where.customerType = customerType;
    }

    if (customerGroupId) {
      where.customerGroupId = customerGroupId;
    }

    if (gstTreatment) {
      where.gstTreatment = gstTreatment;
    }

    if (filters.lifecycleStage) {
      where.lifecycleStage = filters.lifecycleStage;
    }

    if (filters.assignedToUserId) {
      where.assignedToUserId = filters.assignedToUserId;
    }

    if (hasOutstandingBalance !== undefined) {
      if (hasOutstandingBalance) {
        where.currentBalance = { gt: 0 };
      } else {
        where.currentBalance = { lte: 0 };
      }
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
        { phone: { contains: search } },
        { gstNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customerGroup: {
            select: { id: true, name: true, discountPercent: true },
          },
          assignedToUser: {
            select: { id: true, name: true },
          },
          _count: {
            select: { invoices: true },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get customer by ID with full details
   */
  async getCustomerById(organizationId: string, id: number) {
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId },
      include: {
        customerGroup: true,
        assignedToUser: {
          select: { id: true, name: true, email: true },
        },
        contacts: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' },
        },
        invoices: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            dueDate: true,
            totalAmount: true,
            balanceDue: true,
            status: true,
            paymentStatus: true,
          },
        },
        estimates: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            estimateNumber: true,
            estimateDate: true,
            totalAmount: true,
            status: true,
          },
        },
        _count: {
          select: {
            invoices: true,
            estimates: true,
            creditNotes: true,
            payments: true,
            interactions: true,
          },
        },
      },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Calculate total outstanding
    const outstanding = await prisma.invoice.aggregate({
      where: {
        customerId: id,
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        status: { notIn: ['VOID', 'DRAFT'] },
      },
      _sum: { balanceDue: true },
    });

    return {
      ...customer,
      totalOutstanding: Number(outstanding._sum.balanceDue || 0),
    };
  }

  /**
   * Update customer
   */
  async updateCustomer(organizationId: string, id: number, data: UpdateCustomerInput) {
    const { contacts, ...customerData } = data;

    const existing = await prisma.customer.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new AppError('Customer not found', 404);
    }

    if (existing.isGuest) {
      throw new AppError('Cannot update guest customer', 400);
    }

    // Auto-set GST treatment if GST number provided/removed
    let gstTreatment = data.gstTreatment;
    if (data.gstNumber !== undefined) {
      if (data.gstNumber && !gstTreatment) {
        gstTreatment = 'REGISTERED_BUSINESS';
      } else if (!data.gstNumber && existing.gstTreatment === 'REGISTERED_BUSINESS') {
        gstTreatment = 'UNREGISTERED';
      }
    }

    // Validate assigned user if provided
    if (data.assignedToUserId) {
      const assignedUser = await prisma.user.findFirst({
        where: { id: data.assignedToUserId, organizationId },
      });
      if (!assignedUser) {
        throw new AppError('Assigned user not found in this organization', 400);
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...customerData,
        gstTreatment,
      },
    });

    logger.info(`Customer updated: ${customer.id}`);

    return this.getCustomerById(organizationId, id);
  }

  /**
   * Delete customer (soft delete by deactivating)
   */
  async deleteCustomer(organizationId: string, id: number) {
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    if (customer.isGuest) {
      throw new AppError('Cannot delete guest customer', 400);
    }

    // If customer has invoices, soft delete
    if (customer._count.invoices > 0) {
      await prisma.customer.update({
        where: { id },
        data: { isActive: false },
      });
      logger.info(`Customer soft deleted: ${id}`);
      return { message: 'Customer deactivated successfully' };
    }

    // If no invoices, hard delete
    await prisma.customer.delete({
      where: { id },
    });

    logger.info(`Customer deleted: ${id}`);
    return { message: 'Customer deleted successfully' };
  }

  /**
   * Add contact to customer
   */
  async addContact(organizationId: string, customerId: number, contact: {
    salutation?: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    designation?: string;
    department?: string;
    isPrimary?: boolean;
  }) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // If setting as primary, unset other primaries
    if (contact.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const newContact = await prisma.customerContact.create({
      data: {
        customerId,
        ...contact,
      },
    });

    return newContact;
  }

  /**
   * Update contact
   */
  async updateContact(organizationId: string, customerId: number, contactId: number, data: {
    salutation?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    designation?: string;
    department?: string;
    isPrimary?: boolean;
    isActive?: boolean;
  }) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    const contact = await prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });

    if (!contact) {
      throw new AppError('Contact not found', 404);
    }

    // If setting as primary, unset other primaries
    if (data.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId, isPrimary: true, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }

    return prisma.customerContact.update({
      where: { id: contactId },
      data,
    });
  }

  /**
   * Delete contact
   */
  async deleteContact(organizationId: string, customerId: number, contactId: number) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    const contact = await prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });

    if (!contact) {
      throw new AppError('Contact not found', 404);
    }

    await prisma.customerContact.delete({
      where: { id: contactId },
    });

    return { message: 'Contact deleted successfully' };
  }

  /**
   * Get or create guest customer for walk-in sales
   */
  async getOrCreateGuestCustomer(organizationId: string) {
    let guest = await prisma.customer.findFirst({
      where: { organizationId, isGuest: true },
    });

    if (!guest) {
      guest = await prisma.customer.create({
        data: {
          organizationId,
          displayName: 'Walk-in Customer',
          customerType: 'INDIVIDUAL',
          gstTreatment: 'CONSUMER',
          isGuest: true,
        },
      });
      logger.info(`Guest customer created for organization: ${organizationId}`);
    }

    return guest;
  }

  /**
   * Get customer groups
   */
  async getCustomerGroups(organizationId: string) {
    return prisma.customerGroup.findMany({
      where: { organizationId, isActive: true },
      include: {
        _count: {
          select: { customers: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create customer group
   */
  async createCustomerGroup(organizationId: string, data: {
    name: string;
    description?: string;
    discountPercent?: number;
  }) {
    const existing = await prisma.customerGroup.findFirst({
      where: { organizationId, name: data.name },
    });

    if (existing) {
      throw new AppError('Customer group with this name already exists', 400);
    }

    return prisma.customerGroup.create({
      data: {
        organizationId,
        ...data,
      },
    });
  }

  /**
   * Update customer group
   */
  async updateCustomerGroup(organizationId: string, id: number, data: {
    name?: string;
    description?: string;
    discountPercent?: number;
    isActive?: boolean;
  }) {
    const group = await prisma.customerGroup.findFirst({
      where: { id, organizationId },
    });

    if (!group) {
      throw new AppError('Customer group not found', 404);
    }

    return prisma.customerGroup.update({
      where: { id },
      data,
    });
  }

  /**
   * Get customer statement (transactions)
   */
  async getCustomerStatement(organizationId: string, customerId: number, dateRange?: { from: Date; to: Date }) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    const where: any = { customerId };
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.from,
        lte: dateRange.to,
      };
    }

    const [invoices, payments, creditNotes] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          ...where,
          status: { notIn: ['VOID', 'DRAFT'] },
        },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          totalAmount: true,
          balanceDue: true,
          status: true,
          paymentStatus: true,
        },
        orderBy: { invoiceDate: 'asc' },
      }),
      prisma.payment.findMany({
        where,
        select: {
          id: true,
          paymentNumber: true,
          paymentDate: true,
          amount: true,
          paymentMode: true,
          invoiceId: true,
        },
        orderBy: { paymentDate: 'asc' },
      }),
      prisma.creditNote.findMany({
        where: {
          ...where,
          status: { notIn: ['VOID', 'DRAFT'] },
        },
        select: {
          id: true,
          creditNoteNumber: true,
          creditNoteDate: true,
          totalAmount: true,
          status: true,
        },
        orderBy: { creditNoteDate: 'asc' },
      }),
    ]);

    // Combine and sort all transactions
    const transactions = [
      ...invoices.map(inv => ({
        type: 'INVOICE' as const,
        id: inv.id,
        number: inv.invoiceNumber,
        date: inv.invoiceDate,
        debit: Number(inv.totalAmount),
        credit: 0,
        balance: 0,
        status: inv.status,
      })),
      ...payments.map(pay => ({
        type: 'PAYMENT' as const,
        id: pay.id,
        number: pay.paymentNumber,
        date: pay.paymentDate,
        debit: 0,
        credit: Number(pay.amount),
        balance: 0,
        status: 'PAID',
      })),
      ...creditNotes.map(cn => ({
        type: 'CREDIT_NOTE' as const,
        id: cn.id,
        number: cn.creditNoteNumber,
        date: cn.creditNoteDate,
        debit: 0,
        credit: Number(cn.totalAmount),
        balance: 0,
        status: cn.status,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = Number(customer.openingBalance);
    transactions.forEach(txn => {
      runningBalance = runningBalance + txn.debit - txn.credit;
      txn.balance = runningBalance;
    });

    return {
      customer: {
        id: customer.id,
        displayName: customer.displayName,
        email: customer.email,
        mobile: customer.mobile,
      },
      openingBalance: Number(customer.openingBalance),
      transactions,
      closingBalance: runningBalance,
    };
  }

  /**
   * Update customer balance (called after invoice/payment operations)
   */
  async updateCustomerBalance(customerId: number) {
    // Calculate total outstanding from unpaid invoices
    const outstanding = await prisma.invoice.aggregate({
      where: {
        customerId,
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        status: { notIn: ['VOID', 'DRAFT'] },
      },
      _sum: { balanceDue: true },
    });

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (customer) {
      const currentBalance = Number(customer.openingBalance) + Number(outstanding._sum.balanceDue || 0);
      
      await prisma.customer.update({
        where: { id: customerId },
        data: { currentBalance },
      });
    }
  }
}

export default new CustomerService();
