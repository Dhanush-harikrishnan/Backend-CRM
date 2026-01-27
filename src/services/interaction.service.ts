import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';

export interface CreateInteractionInput {
  organizationId: string;
  customerId: number;
  userId: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'SMS' | 'WHATSAPP';
  description: string;
  date?: Date | string;
  outcome?: string;
}

export interface UpdateInteractionInput {
  type?: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'SMS' | 'WHATSAPP';
  description?: string;
  date?: Date | string;
  outcome?: string;
}

export interface InteractionListFilters {
  organizationId: string;
  customerId?: number;
  userId?: string;
  type?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

class InteractionService {
  /**
   * Create a new interaction
   */
  async createInteraction(data: CreateInteractionInput) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: data.organizationId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    const interaction = await prisma.interaction.create({
      data: {
        organizationId: data.organizationId,
        customerId: data.customerId,
        userId: data.userId,
        type: data.type,
        description: data.description,
        date: data.date ? new Date(data.date) : new Date(),
        outcome: data.outcome,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    logger.info(`Interaction created: ${interaction.id} for customer ${data.customerId}`);

    return interaction;
  }

  /**
   * Get all interactions with filtering
   */
  async getInteractions(filters: InteractionListFilters) {
    const {
      organizationId,
      customerId,
      userId,
      type,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = {
      organizationId,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (type) {
      where.type = type;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = dateFrom;
      if (dateTo) where.date.lte = dateTo;
    }

    const skip = (page - 1) * limit;

    const [interactions, total] = await Promise.all([
      prisma.interaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          user: {
            select: { id: true, name: true },
          },
          customer: {
            select: { id: true, displayName: true },
          },
        },
      }),
      prisma.interaction.count({ where }),
    ]);

    return {
      data: interactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get interaction by ID
   */
  async getInteractionById(organizationId: string, id: number) {
    const interaction = await prisma.interaction.findFirst({
      where: { id, organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        customer: {
          select: { id: true, displayName: true },
        },
      },
    });

    if (!interaction) {
      throw new AppError('Interaction not found', 404);
    }

    return interaction;
  }

  /**
   * Update interaction
   */
  async updateInteraction(organizationId: string, id: number, data: UpdateInteractionInput) {
    const existing = await prisma.interaction.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new AppError('Interaction not found', 404);
    }

    const interaction = await prisma.interaction.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });

    return interaction;
  }

  /**
   * Delete interaction
   */
  async deleteInteraction(organizationId: string, id: number) {
    const existing = await prisma.interaction.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new AppError('Interaction not found', 404);
    }

    await prisma.interaction.delete({
      where: { id },
    });

    return { message: 'Interaction deleted successfully' };
  }
}

export default new InteractionService();
