import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import invoiceService from '../services/invoice.service';
import { CreateInvoiceInput } from '../validators';
import logger from '../config/logger';

export class InvoiceController {
  /**
   * @route   POST /api/invoices
   * @desc    Create a new invoice (with transaction logic)
   * @access  Private (requires JWT)
   */
  createInvoice = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const invoiceData: CreateInvoiceInput = req.body;

      logger.info(`Creating invoice for customer ${invoiceData.customerId} by user ${req.user?.email}`);

      const invoice = await invoiceService.createInvoice(invoiceData);

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: invoice,
      });
    }
  );

  /**
   * @route   GET /api/invoices/:id
   * @desc    Get invoice by ID
   * @access  Private
   */
  getInvoiceById = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const id = parseInt(req.params.id, 10);

      const invoice = await invoiceService.getInvoiceById(id);

      res.status(200).json({
        success: true,
        data: invoice,
      });
    }
  );

  /**
   * @route   GET /api/invoices
   * @desc    Get all invoices with filters
   * @access  Private
   */
  getInvoices = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const {
        startDate,
        endDate,
        customerId,
        paymentMode,
        page,
        limit,
      } = req.query;

      const filters = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        customerId: customerId ? parseInt(customerId as string, 10) : undefined,
        paymentMode: paymentMode as string | undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      };

      const result = await invoiceService.getInvoices(filters);

      res.status(200).json({
        success: true,
        data: result.invoices,
        pagination: result.pagination,
      });
    }
  );

  /**
   * @route   GET /api/invoices/summary
   * @desc    Get sales summary
   * @access  Private (Admin only)
   */
  getSalesSummary = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const { startDate, endDate } = req.query;

      const summary = await invoiceService.getSalesSummary(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.status(200).json({
        success: true,
        data: summary,
      });
    }
  );
}

export default new InvoiceController();
