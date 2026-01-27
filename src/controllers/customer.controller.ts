import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import customerService from '../services/customer.service';

export class CustomerController {
  createCustomer = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const customer = await customerService.createCustomer({
        ...req.body,
        organizationId,
      });

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: customer,
      });
    }
  );

  getAllCustomers = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const { search, page, limit, sortBy, sortOrder, customerType, isActive, lifecycleStage, assignedToUserId } = req.query;
      
      const result = await customerService.getAllCustomers({
        organizationId,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        sortBy: sortBy as any,
        sortOrder: sortOrder as 'asc' | 'desc',
        customerType: customerType as any,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        lifecycleStage: lifecycleStage as string,
        assignedToUserId: assignedToUserId as string,
      });

      res.status(200).json({
        success: true,
        count: result.data.length,
        data: result.data,
        pagination: result.pagination,
      });
    }
  );

  getCustomerById = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);
      const customer = await customerService.getCustomerById(organizationId, id);

      res.status(200).json({
        success: true,
        data: customer,
      });
    }
  );

  updateCustomer = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);
      const customer = await customerService.updateCustomer(organizationId, id, req.body);

      res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
        data: customer,
      });
    }
  );

  deleteCustomer = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);
      const result = await customerService.deleteCustomer(organizationId, id);

      res.status(200).json({
        success: true,
        ...result,
      });
    }
  );

  getCustomerStatement = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);
      const { startDate, endDate } = req.query;

      const dateRange = startDate && endDate ? {
        from: new Date(startDate as string),
        to: new Date(endDate as string)
      } : undefined;

      const statement = await customerService.getCustomerStatement(
        organizationId, 
        id,
        dateRange
      );

      res.status(200).json({
        success: true,
        data: statement,
      });
    }
  );
}

export default new CustomerController();
