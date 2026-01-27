import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';
import organizationService from './organization.service';

export interface EstimateItemInput {
  productId?: number;
  itemType?: 'GOODS' | 'SERVICE' | 'BUNDLE';
  name: string;
  description?: string;
  hsnCode?: string;
  sacCode?: string;
  quantity: number;
  unit?: string;
  rate: number;
  discountType?: 'FIXED' | 'PERCENTAGE';
  discountValue?: number;
  taxId?: number;
}

export interface CreateEstimateInput {
  organizationId: string;
  customerId: number;
  referenceNumber?: string;
  estimateDate?: Date;
  expiryDate?: Date;
  placeOfSupply?: string;
  items: EstimateItemInput[];
  discountType?: 'FIXED' | 'PERCENTAGE';
  discountValue?: number;
  shippingCharge?: number;
  adjustmentAmount?: number;
  adjustmentDesc?: string;
  customerNotes?: string;
  termsConditions?: string;
  privateNotes?: string;
}

export interface UpdateEstimateInput extends Partial<Omit<CreateEstimateInput, 'organizationId'>> {}

export interface EstimateListFilters {
  organizationId: string;
  customerId?: number;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'estimateDate' | 'estimateNumber' | 'totalAmount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

class EstimateService {
  /**
   * Calculate item amounts with GST breakdown
   */
  private calculateItemAmounts(
    item: EstimateItemInput,
    isInterState: boolean,
    tax?: { rate: number; cgstRate: number | null; sgstRate: number | null; igstRate: number | null; cessRate: number | null }
  ) {
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
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
   * Create a new estimate/quote
   */
  async createEstimate(data: CreateEstimateInput) {
    const { organizationId, customerId, items, ...estimateData } = data;

    // Validate customer
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Get organization for state comparison
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    // Determine if inter-state (for GST calculation)
    const placeOfSupply = data.placeOfSupply || customer.placeOfSupply || org.state;
    const isInterState = placeOfSupply !== org.state;

    // Generate estimate number
    const estimateNumber = await organizationService.getNextSequenceNumber(organizationId, 'estimate');

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

    const estimateItems = items.map((item, index) => {
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

    // Calculate estimate-level discount
    let estimateDiscountAmount = 0;
    if (estimateData.discountValue) {
      if (estimateData.discountType === 'PERCENTAGE') {
        estimateDiscountAmount = (subtotal * Number(estimateData.discountValue)) / 100;
      } else {
        estimateDiscountAmount = Number(estimateData.discountValue);
      }
    }

    const taxableAmount = subtotal - estimateDiscountAmount;
    const totalTax = totalCgst + totalSgst + totalIgst + totalCess;
    const shippingCharge = Number(estimateData.shippingCharge || 0);
    const adjustmentAmount = Number(estimateData.adjustmentAmount || 0);
    const totalAmount = taxableAmount + totalTax + shippingCharge + adjustmentAmount;

    // Create estimate with items
    const estimate = await prisma.estimate.create({
      data: {
        organizationId,
        customerId,
        estimateNumber,
        referenceNumber: estimateData.referenceNumber,
        estimateDate: estimateData.estimateDate || new Date(),
        expiryDate: estimateData.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        placeOfSupply,
        isInterState,
        subtotal,
        discountType: estimateData.discountType || 'FIXED',
        discountValue: estimateData.discountValue || 0,
        discountAmount: estimateDiscountAmount,
        taxableAmount,
        cgstAmount: totalCgst,
        sgstAmount: totalSgst,
        igstAmount: totalIgst,
        cessAmount: totalCess,
        totalTax,
        shippingCharge,
        adjustmentAmount,
        adjustmentDesc: estimateData.adjustmentDesc,
        totalAmount,
        customerNotes: estimateData.customerNotes,
        termsConditions: estimateData.termsConditions,
        privateNotes: estimateData.privateNotes,
        status: 'DRAFT',
        items: {
          create: estimateItems,
        },
      },
      include: {
        customer: {
          select: { id: true, displayName: true, email: true, mobile: true },
        },
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    logger.info(`Estimate created: ${estimate.estimateNumber}`);
    return estimate;
  }

  /**
   * Get all estimates with filtering
   */
  async getAllEstimates(filters: EstimateListFilters) {
    const {
      organizationId,
      customerId,
      status,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { organizationId };

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.estimateDate = {};
      if (dateFrom) where.estimateDate.gte = dateFrom;
      if (dateTo) where.estimateDate.lte = dateTo;
    }

    if (search) {
      where.OR = [
        { estimateNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { displayName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [estimates, total] = await Promise.all([
      prisma.estimate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, displayName: true, email: true },
          },
        },
      }),
      prisma.estimate.count({ where }),
    ]);

    return {
      data: estimates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get estimate by ID
   */
  async getEstimateById(organizationId: string, id: number) {
    const estimate = await prisma.estimate.findFirst({
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
        invoices: {
          select: { id: true, invoiceNumber: true, status: true },
        },
      },
    });

    if (!estimate) {
      throw new AppError('Estimate not found', 404);
    }

    return estimate;
  }

  /**
   * Update estimate
   */
  async updateEstimate(organizationId: string, id: number, data: UpdateEstimateInput) {
    const existing = await prisma.estimate.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new AppError('Estimate not found', 404);
    }

    if (existing.status === 'INVOICED') {
      throw new AppError('Cannot update an invoiced estimate', 400);
    }

    // If items are being updated, recalculate everything
    if (data.items) {
      // Delete existing items
      await prisma.estimateItem.deleteMany({
        where: { estimateId: id },
      });

      // Use the create logic for recalculation
      const updateData = {
        ...data,
        organizationId,
        customerId: data.customerId || existing.customerId,
        items: data.items,
      };

      // Get organization for state comparison
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      const customer = await prisma.customer.findUnique({
        where: { id: updateData.customerId },
      });

      const placeOfSupply = data.placeOfSupply || customer?.placeOfSupply || org?.state;
      const isInterState = placeOfSupply !== org?.state;

      // Fetch products
      const productIds = data.items.filter(i => i.productId).map(i => i.productId) as number[];
      const products = productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds }, organizationId },
            include: { tax: true },
          })
        : [];
      const productMap = new Map(products.map(p => [p.id, p]));

      // Calculate
      let subtotal = 0;
      let totalCgst = 0, totalSgst = 0, totalIgst = 0, totalCess = 0;

      const estimateItems = data.items.map((item, index) => {
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
          estimateId: id,
          productId: item.productId,
          itemType: item.itemType || product?.type || 'GOODS',
          name: item.name || product?.name || '',
          description: item.description || product?.description,
          hsnCode: item.hsnCode || product?.hsnCode,
          sacCode: item.sacCode || product?.sacCode,
          quantity: item.quantity,
          unit: item.unit || product?.unit || 'PCS',
          rate: item.rate,
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

      // Calculate estimate-level discount
      let estimateDiscountAmount = 0;
      if (data.discountValue) {
        if (data.discountType === 'PERCENTAGE') {
          estimateDiscountAmount = (subtotal * Number(data.discountValue)) / 100;
        } else {
          estimateDiscountAmount = Number(data.discountValue);
        }
      }

      const taxableAmount = subtotal - estimateDiscountAmount;
      const totalTax = totalCgst + totalSgst + totalIgst + totalCess;
      const shippingCharge = Number(data.shippingCharge ?? existing.shippingCharge);
      const adjustmentAmount = Number(data.adjustmentAmount ?? existing.adjustmentAmount);
      const totalAmount = taxableAmount + totalTax + shippingCharge + adjustmentAmount;

      // Update estimate and create items
      await prisma.estimateItem.createMany({
        data: estimateItems,
      });

      const estimate = await prisma.estimate.update({
        where: { id },
        data: {
          customerId: data.customerId,
          referenceNumber: data.referenceNumber,
          estimateDate: data.estimateDate,
          expiryDate: data.expiryDate,
          placeOfSupply,
          isInterState,
          subtotal,
          discountType: data.discountType || 'FIXED',
          discountValue: data.discountValue || 0,
          discountAmount: estimateDiscountAmount,
          taxableAmount,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          cessAmount: totalCess,
          totalTax,
          shippingCharge,
          adjustmentAmount,
          adjustmentDesc: data.adjustmentDesc,
          totalAmount,
          customerNotes: data.customerNotes,
          termsConditions: data.termsConditions,
          privateNotes: data.privateNotes,
        },
        include: {
          customer: true,
          items: { orderBy: { sortOrder: 'asc' } },
        },
      });

      logger.info(`Estimate updated: ${estimate.estimateNumber}`);
      return estimate;
    }

    // Simple update without items
    const estimate = await prisma.estimate.update({
      where: { id },
      data: {
        customerId: data.customerId,
        referenceNumber: data.referenceNumber,
        estimateDate: data.estimateDate,
        expiryDate: data.expiryDate,
        customerNotes: data.customerNotes,
        termsConditions: data.termsConditions,
        privateNotes: data.privateNotes,
      },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return estimate;
  }

  /**
   * Update estimate status
   */
  async updateStatus(organizationId: string, id: number, status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED') {
    const estimate = await prisma.estimate.findFirst({
      where: { id, organizationId },
    });

    if (!estimate) {
      throw new AppError('Estimate not found', 404);
    }

    if (estimate.status === 'INVOICED') {
      throw new AppError('Cannot update status of an invoiced estimate', 400);
    }

    return prisma.estimate.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Convert estimate to invoice
   */
  async convertToInvoice(organizationId: string, estimateId: number) {
    const estimate = await this.getEstimateById(organizationId, estimateId);

    if (estimate.status === 'INVOICED') {
      throw new AppError('Estimate already converted to invoice', 400);
    }

    if (estimate.status === 'DECLINED' || estimate.status === 'EXPIRED') {
      throw new AppError('Cannot convert declined or expired estimate', 400);
    }

    // Import invoice service dynamically to avoid circular dependency
    const invoiceService = (await import('./invoice.service')).default;

    // Convert estimate items to invoice items format
    const invoiceItems = estimate.items.map(item => ({
      productId: item.productId || undefined,
      itemType: item.itemType,
      name: item.name,
      description: item.description || undefined,
      hsnCode: item.hsnCode || undefined,
      sacCode: item.sacCode || undefined,
      quantity: Number(item.quantity),
      unit: item.unit || undefined,
      rate: Number(item.rate),
      discountType: item.discountType || undefined,
      discountValue: Number(item.discountValue),
    }));

    // Create invoice from estimate
    const invoice = await invoiceService.createInvoice({
      organizationId,
      customerId: estimate.customerId,
      estimateId: estimate.id,
      items: invoiceItems,
      discountType: estimate.discountType,
      discountValue: Number(estimate.discountValue),
      shippingCharge: Number(estimate.shippingCharge),
      adjustmentAmount: Number(estimate.adjustmentAmount),
      adjustmentDesc: estimate.adjustmentDesc || undefined,
      customerNotes: estimate.customerNotes || undefined,
      termsConditions: estimate.termsConditions || undefined,
      privateNotes: estimate.privateNotes || undefined,
      placeOfSupply: estimate.placeOfSupply || undefined,
    });

    // Update estimate status
    await prisma.estimate.update({
      where: { id: estimateId },
      data: { status: 'INVOICED' },
    });

    logger.info(`Estimate ${estimate.estimateNumber} converted to invoice ${invoice.invoiceNumber}`);

    return invoice;
  }

  /**
   * Delete estimate
   */
  async deleteEstimate(organizationId: string, id: number) {
    const estimate = await prisma.estimate.findFirst({
      where: { id, organizationId },
    });

    if (!estimate) {
      throw new AppError('Estimate not found', 404);
    }

    if (estimate.status === 'INVOICED') {
      throw new AppError('Cannot delete an invoiced estimate', 400);
    }

    await prisma.estimate.delete({
      where: { id },
    });

    logger.info(`Estimate deleted: ${id}`);
    return { message: 'Estimate deleted successfully' };
  }

  /**
   * Duplicate estimate
   */
  async duplicateEstimate(organizationId: string, id: number) {
    const original = await this.getEstimateById(organizationId, id);

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

    return this.createEstimate({
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
}

export default new EstimateService();
