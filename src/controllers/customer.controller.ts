import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import customerService from '../services/customer.service';

export class CustomerController {
  createCustomer = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const customer = await customerService.createCustomer(req.body);

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: customer,
      });
    }
  );

  getAllCustomers = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const { search } = req.query;
      const customers = await customerService.getAllCustomers(search as string);

      res.status(200).json({
        success: true,
        count: customers.length,
        data: customers,
      });
    }
  );

  getCustomerById = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const id = parseInt(req.params.id, 10);
      const customer = await customerService.getCustomerById(id);

      res.status(200).json({
        success: true,
        data: customer,
      });
    }
  );

  updateCustomer = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const id = parseInt(req.params.id, 10);
      const customer = await customerService.updateCustomer(id, req.body);

      res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
        data: customer,
      });
    }
  );

  deleteCustomer = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const id = parseInt(req.params.id, 10);
      const result = await customerService.deleteCustomer(id);

      res.status(200).json({
        success: true,
        ...result,
      });
    }
  );
}

export default new CustomerController();
