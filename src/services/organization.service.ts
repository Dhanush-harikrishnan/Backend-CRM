import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';

// Indian states with codes for GST
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

export interface CreateOrganizationInput {
  name: string;
  slug?: string;
  email: string;
  phone?: string;
  website?: string;
  businessType?: 'INDIVIDUAL' | 'BUSINESS' | 'PARTNERSHIP' | 'LLP' | 'PRIVATE_LIMITED' | 'PUBLIC_LIMITED' | 'TRUST' | 'SOCIETY' | 'OTHER';
  industryType?: string;
  registrationNumber?: string;
  gstNumber?: string;
  panNumber?: string;
  taxRegistered?: boolean;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  logo?: string;
  brandColor?: string;
  currencyCode?: string;
  currencySymbol?: string;
  dateFormat?: string;
  financialYearStart?: number;
  invoicePrefix?: string;
  invoiceStartNumber?: number;
  estimatePrefix?: string;
  estimateStartNumber?: number;
  creditNotePrefix?: string;
  creditNoteStartNumber?: number;
  defaultPaymentTerms?: number;
  defaultInvoiceNotes?: string;
  defaultTermsConditions?: string;
}

export interface UpdateOrganizationInput extends Partial<CreateOrganizationInput> {}

class OrganizationService {
  /**
   * Generate a URL-friendly slug from organization name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Ensure slug is unique
   */
  private async ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;
    
    while (true) {
      const existing = await prisma.organization.findUnique({
        where: { slug },
      });
      
      if (!existing || existing.id === excludeId) {
        return slug;
      }
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Create a new organization
   */
  async createOrganization(data: CreateOrganizationInput) {
    const baseSlug = data.slug || this.generateSlug(data.name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const organization = await prisma.organization.create({
      data: {
        ...data,
        slug,
        businessType: data.businessType || 'BUSINESS',
        taxRegistered: data.taxRegistered || !!data.gstNumber,
      },
    });

    logger.info(`Organization created: ${organization.id} - ${organization.name}`);

    // Create default taxes for the organization
    await this.createDefaultTaxes(organization.id);
    
    // Create default bank account (Cash)
    await this.createDefaultBankAccount(organization.id);

    return organization;
  }

  /**
   * Create default GST tax rates
   */
  private async createDefaultTaxes(organizationId: string) {
    const defaultTaxes = [
      { name: 'GST 0%', rate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0 },
      { name: 'GST 5%', rate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 },
      { name: 'GST 12%', rate: 12, cgstRate: 6, sgstRate: 6, igstRate: 12 },
      { name: 'GST 18%', rate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18, isDefault: true },
      { name: 'GST 28%', rate: 28, cgstRate: 14, sgstRate: 14, igstRate: 28 },
    ];

    await prisma.tax.createMany({
      data: defaultTaxes.map(tax => ({
        organizationId,
        ...tax,
        taxType: 'GST' as const,
      })),
    });

    logger.info(`Default taxes created for organization: ${organizationId}`);
  }

  /**
   * Create default Cash bank account
   */
  private async createDefaultBankAccount(organizationId: string) {
    await prisma.bankAccount.create({
      data: {
        organizationId,
        accountName: 'Cash',
        accountType: 'CASH',
        isPrimary: true,
      },
    });

    logger.info(`Default bank account created for organization: ${organizationId}`);
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(id: string) {
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            customers: true,
            products: true,
            invoices: true,
          },
        },
      },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    return organization;
  }

  /**
   * Get organization by slug
   */
  async getOrganizationBySlug(slug: string) {
    const organization = await prisma.organization.findUnique({
      where: { slug },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    return organization;
  }

  /**
   * Update organization
   */
  async updateOrganization(id: string, data: UpdateOrganizationInput) {
    const existing = await prisma.organization.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Organization not found', 404);
    }

    // Handle slug update
    let slug = existing.slug;
    if (data.slug && data.slug !== existing.slug) {
      slug = await this.ensureUniqueSlug(data.slug, id);
    } else if (data.name && !data.slug && data.name !== existing.name) {
      // Auto-update slug if name changed
      const baseSlug = this.generateSlug(data.name);
      slug = await this.ensureUniqueSlug(baseSlug, id);
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        ...data,
        slug,
        taxRegistered: data.gstNumber ? true : data.taxRegistered,
      },
    });

    logger.info(`Organization updated: ${organization.id}`);
    return organization;
  }

  /**
   * Update organization settings
   */
  async updateSettings(id: string, settings: {
    invoicePrefix?: string;
    invoiceStartNumber?: number;
    estimatePrefix?: string;
    estimateStartNumber?: number;
    creditNotePrefix?: string;
    creditNoteStartNumber?: number;
    defaultPaymentTerms?: number;
    defaultInvoiceNotes?: string;
    defaultTermsConditions?: string;
    dateFormat?: string;
    financialYearStart?: number;
  }) {
    const organization = await prisma.organization.update({
      where: { id },
      data: settings,
    });

    logger.info(`Organization settings updated: ${id}`);
    return organization;
  }

  /**
   * Get organization taxes
   */
  async getTaxes(organizationId: string, includeInactive = false) {
    const where: any = { organizationId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return prisma.tax.findMany({
      where,
      orderBy: { rate: 'asc' },
    });
  }

  /**
   * Create a new tax
   */
  async createTax(organizationId: string, data: {
    name: string;
    rate: number;
    cgstRate?: number;
    sgstRate?: number;
    igstRate?: number;
    cessRate?: number;
    taxType?: 'GST' | 'VAT' | 'SALES_TAX' | 'SERVICE_TAX' | 'EXEMPT' | 'CUSTOM';
    isDefault?: boolean;
  }) {
    // Validate rates for GST
    if (data.taxType === 'GST') {
      const cgst = data.cgstRate || 0;
      const sgst = data.sgstRate || 0;
      
      if (cgst + sgst !== data.rate) {
        throw new AppError('CGST + SGST must equal the total rate', 400);
      }
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.tax.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const tax = await prisma.tax.create({
      data: {
        organizationId,
        ...data,
        taxType: data.taxType || 'GST',
      },
    });

    return tax;
  }

  /**
   * Update a tax
   */
  async updateTax(organizationId: string, taxId: number, data: {
    name?: string;
    rate?: number;
    cgstRate?: number;
    sgstRate?: number;
    igstRate?: number;
    cessRate?: number;
    isDefault?: boolean;
    isActive?: boolean;
  }) {
    const tax = await prisma.tax.findFirst({
      where: { id: taxId, organizationId },
    });

    if (!tax) {
      throw new AppError('Tax not found', 404);
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.tax.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.tax.update({
      where: { id: taxId },
      data,
    });
  }

  /**
   * Get organization bank accounts
   */
  async getBankAccounts(organizationId: string, includeInactive = false) {
    const where: any = { organizationId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return prisma.bankAccount.findMany({
      where,
      orderBy: { isPrimary: 'desc' },
    });
  }

  /**
   * Get organization dashboard summary
   */
  async getDashboardSummary(organizationId: string, dateRange?: { from: Date; to: Date }) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const from = dateRange?.from || startOfMonth;
    const to = dateRange?.to || endOfMonth;

    // Get invoice statistics
    const [
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      overdueInvoices,
      totalRevenue,
      totalReceived,
      totalOutstanding,
      recentInvoices,
      topCustomers,
    ] = await Promise.all([
      // Total invoices
      prisma.invoice.count({
        where: {
          organizationId,
          invoiceDate: { gte: from, lte: to },
          status: { not: 'VOID' },
        },
      }),
      // Paid invoices
      prisma.invoice.count({
        where: {
          organizationId,
          invoiceDate: { gte: from, lte: to },
          paymentStatus: 'PAID',
        },
      }),
      // Unpaid invoices
      prisma.invoice.count({
        where: {
          organizationId,
          paymentStatus: 'UNPAID',
          status: { notIn: ['VOID', 'DRAFT'] },
        },
      }),
      // Overdue invoices
      prisma.invoice.count({
        where: {
          organizationId,
          paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
          dueDate: { lt: now },
          status: { notIn: ['VOID', 'DRAFT'] },
        },
      }),
      // Total revenue (this period)
      prisma.invoice.aggregate({
        where: {
          organizationId,
          invoiceDate: { gte: from, lte: to },
          status: { notIn: ['VOID', 'DRAFT'] },
        },
        _sum: { totalAmount: true },
      }),
      // Total received (this period)
      prisma.payment.aggregate({
        where: {
          organizationId,
          paymentDate: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
      // Total outstanding
      prisma.invoice.aggregate({
        where: {
          organizationId,
          paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
          status: { notIn: ['VOID', 'DRAFT'] },
        },
        _sum: { balanceDue: true },
      }),
      // Recent invoices
      prisma.invoice.findMany({
        where: { organizationId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { displayName: true },
          },
        },
      }),
      // Top customers by revenue
      prisma.invoice.groupBy({
        by: ['customerId'],
        where: {
          organizationId,
          invoiceDate: { gte: from, lte: to },
          status: { notIn: ['VOID', 'DRAFT'] },
        },
        _sum: { totalAmount: true },
        _count: true,
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 5,
      }),
    ]);

    // Get customer details for top customers
    const customerIds = topCustomers.map(c => c.customerId);
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, displayName: true },
    });
    const customerMap = new Map(customers.map(c => [c.id, c]));

    return {
      period: { from, to },
      invoices: {
        total: totalInvoices,
        paid: paidInvoices,
        unpaid: unpaidInvoices,
        overdue: overdueInvoices,
      },
      revenue: {
        total: Number(totalRevenue._sum.totalAmount || 0),
        received: Number(totalReceived._sum.amount || 0),
        outstanding: Number(totalOutstanding._sum.balanceDue || 0),
      },
      recentInvoices: recentInvoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer.displayName,
        totalAmount: Number(inv.totalAmount),
        status: inv.status,
        paymentStatus: inv.paymentStatus,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
      })),
      topCustomers: topCustomers.map(tc => ({
        customer: customerMap.get(tc.customerId),
        totalAmount: Number(tc._sum.totalAmount || 0),
        invoiceCount: tc._count,
      })),
    };
  }

  /**
   * Get next sequence number for documents
   */
  async getNextSequenceNumber(
    organizationId: string,
    type: 'invoice' | 'estimate' | 'creditNote' | 'payment'
  ): Promise<string> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    const today = new Date();
    const fy = today.getMonth() + 1 >= (org.financialYearStart || 4)
      ? today.getFullYear()
      : today.getFullYear() - 1;

    let prefix: string;
    let startNumber: number;
    let countField: 'invoices' | 'estimates' | 'creditNotes' | 'payments';

    switch (type) {
      case 'invoice':
        prefix = org.invoicePrefix || 'INV';
        startNumber = org.invoiceStartNumber || 1;
        countField = 'invoices';
        break;
      case 'estimate':
        prefix = org.estimatePrefix || 'EST';
        startNumber = org.estimateStartNumber || 1;
        countField = 'estimates';
        break;
      case 'creditNote':
        prefix = org.creditNotePrefix || 'CN';
        startNumber = org.creditNoteStartNumber || 1;
        countField = 'creditNotes';
        break;
      case 'payment':
        prefix = org.paymentPrefix || 'PAY';
        startNumber = org.paymentStartNumber || 1;
        countField = 'payments';
        break;
    }

    // Get count of existing documents
    const count = await (prisma as any)[countField === 'creditNotes' ? 'creditNote' : countField.slice(0, -1)].count({
      where: { organizationId },
    });

    const sequenceNumber = startNumber + count;
    const paddedNumber = sequenceNumber.toString().padStart(4, '0');

    return `${prefix}-${fy}-${paddedNumber}`;
  }

  /**
   * Get Indian states list
   */
  getIndianStates() {
    return INDIAN_STATES;
  }
}

export default new OrganizationService();
