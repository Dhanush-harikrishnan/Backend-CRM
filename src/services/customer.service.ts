import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { CreateCustomerInput } from '../validators';

export class CustomerService {
  async createCustomer(data: CreateCustomerInput) {
    // Check if mobile already exists (if provided)
    if (data.mobile) {
      const existingCustomer = await prisma.customer.findFirst({
        where: { mobile: data.mobile },
      });

      if (existingCustomer) {
        throw new AppError('Customer with this mobile number already exists', 400);
      }
    }

    const customer = await prisma.customer.create({
      data: {
        ...data,
        isGuest: false,
      },
    });

    return customer;
  }

  async getAllCustomers(search?: string) {
    const where: any = {
      isGuest: false, // Exclude guest customer from listings
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return customers;
  }

  async getCustomerById(id: number) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paymentMode: true,
            createdAt: true,
          },
        },
        _count: {
          select: { invoices: true },
        },
      },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    return customer;
  }

  async updateCustomer(id: number, data: Partial<CreateCustomerInput>) {
    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      throw new AppError('Customer not found', 404);
    }

    // Prevent updating guest customer
    if (existingCustomer.isGuest) {
      throw new AppError('Cannot update guest customer', 400);
    }

    // If mobile is being updated, check for duplicates
    if (data.mobile && data.mobile !== existingCustomer.mobile) {
      const mobileExists = await prisma.customer.findFirst({
        where: {
          mobile: data.mobile,
          id: { not: id },
        },
      });

      if (mobileExists) {
        throw new AppError('Customer with this mobile number already exists', 400);
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data,
    });

    return customer;
  }

  async deleteCustomer(id: number) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Prevent deleting guest customer
    if (customer.isGuest) {
      throw new AppError('Cannot delete guest customer', 400);
    }

    // Prevent deleting customers with invoices
    if (customer._count.invoices > 0) {
      throw new AppError(
        'Cannot delete customer with existing invoices. Archive instead.',
        400
      );
    }

    await prisma.customer.delete({
      where: { id },
    });

    return { message: 'Customer deleted successfully' };
  }
}

export default new CustomerService();
