import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { CreateVendorInput } from '../validators';
import logger from '../config/logger';

export interface VendorListFilters {
  organizationId: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

class VendorService {
  /**
   * Create a new vendor
   */
  async createVendor(organizationId: string, data: CreateVendorInput) {
    const existing = await prisma.vendor.findFirst({
      where: { organizationId, name: data.name },
    });

    if (existing) {
      throw new AppError('Vendor with this name already exists', 400);
    }

    const vendor = await prisma.vendor.create({
      data: {
        organizationId,
        ...data,
      },
    });

    logger.info(`Vendor created: ${vendor.id} - ${vendor.name}`);
    return vendor;
  }

  /**
   * Get all vendors with filtering
   */
  async getAllVendors(filters: VendorListFilters) {
    const {
      organizationId,
      search,
      isActive = true,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { organizationId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { gstNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { purchases: true, expenses: true },
          },
        },
      }),
      prisma.vendor.count({ where }),
    ]);

    return {
      data: vendors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get vendor by ID
   */
  async getVendorById(organizationId: string, id: number) {
    const vendor = await prisma.vendor.findFirst({
      where: { id, organizationId },
      include: {
        purchases: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        expenses: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vendor) {
      throw new AppError('Vendor not found', 404);
    }

    return vendor;
  }

  /**
   * Update vendor
   */
  async updateVendor(organizationId: string, id: number, data: Partial<CreateVendorInput> & { isActive?: boolean }) {
    const existing = await prisma.vendor.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new AppError('Vendor not found', 404);
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.vendor.findFirst({
        where: { organizationId, name: data.name, id: { not: id } },
      });
      if (duplicate) {
        throw new AppError('Vendor with this name already exists', 400);
      }
    }

    const vendor = await prisma.vendor.update({
      where: { id },
      data,
    });

    return vendor;
  }

  /**
   * Delete vendor
   */
  async deleteVendor(organizationId: string, id: number) {
    const vendor = await prisma.vendor.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { purchases: true, expenses: true },
        },
      },
    });

    if (!vendor) {
      throw new AppError('Vendor not found', 404);
    }

    // Soft delete if used
    if (vendor._count.purchases > 0 || vendor._count.expenses > 0) {
      await prisma.vendor.update({
        where: { id },
        data: { isActive: false },
      });
      return { message: 'Vendor deactivated successfully' };
    }

    await prisma.vendor.delete({
      where: { id },
    });

    return { message: 'Vendor deleted successfully' };
  }
}

export default new VendorService();
