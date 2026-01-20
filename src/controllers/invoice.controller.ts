import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import invoiceService from '../services/invoice.service';
import logger from '../config/logger';

export class InvoiceController {
  /**
   * @route   POST /api/invoices
   * @desc    Create a new invoice (with transaction logic)
   * @access  Private (requires JWT)
   */
  createInvoice = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;

      logger.info(`Creating invoice for customer ${req.body.customerId} by user ${req.user?.email}`);

      const invoice = await invoiceService.createInvoice({
        ...req.body,
        organizationId,
      });

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
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);

      const invoice = await invoiceService.getInvoiceById(organizationId, id);

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
      const organizationId = req.user!.organizationId;
      const {
        dateFrom,
        dateTo,
        customerId,
        status,
        paymentStatus,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      } = req.query;

      const result = await invoiceService.getAllInvoices({
        organizationId,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        customerId: customerId ? parseInt(customerId as string, 10) : undefined,
        status: status as any,
        paymentStatus: paymentStatus as any,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        sortBy: sortBy as any,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    }
  );

  /**
   * @route   PUT /api/invoices/:id
   * @desc    Update invoice (draft only)
   * @access  Private
   */
  updateInvoice = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);

      const invoice = await invoiceService.updateInvoice(organizationId, id, req.body);

      res.status(200).json({
        success: true,
        message: 'Invoice updated successfully',
        data: invoice,
      });
    }
  );

  /**
   * @route   PUT /api/invoices/:id/status
   * @desc    Update invoice status
   * @access  Private
   */
  updateStatus = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;

      const invoice = await invoiceService.updateStatus(organizationId, id, status);

      res.status(200).json({
        success: true,
        message: `Invoice marked as ${status}`,
        data: invoice,
      });
    }
  );

  /**
   * @route   POST /api/invoices/:id/payments
   * @desc    Record cash payment for invoice
   * @access  Private
   */
  recordPayment = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);

      const result = await invoiceService.recordCashPayment(organizationId, id, req.body);

      res.status(200).json({
        success: true,
        message: 'Payment recorded successfully',
        data: result,
      });
    }
  );

  /**
   * @route   DELETE /api/invoices/:id
   * @desc    Delete invoice
   * @access  Private (Admin only)
   */
  deleteInvoice = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);

      await invoiceService.deleteInvoice(organizationId, id);

      res.status(200).json({
        success: true,
        message: 'Invoice deleted successfully',
      });
    }
  );

  /**
   * @route   POST /api/invoices/:id/duplicate
   * @desc    Duplicate an invoice
   * @access  Private
   */
  duplicateInvoice = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);

      const invoice = await invoiceService.duplicateInvoice(organizationId, id);

      res.status(201).json({
        success: true,
        message: 'Invoice duplicated successfully',
        data: invoice,
      });
    }
  );

  /**
   * @route   GET /api/invoices/summary
   * @desc    Get invoice summary
   * @access  Private
   */
  getSummary = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const { startDate, endDate } = req.query;

      const dateRange = startDate && endDate ? {
        from: new Date(startDate as string),
        to: new Date(endDate as string)
      } : undefined;

      const summary = await invoiceService.getInvoiceSummary(
        organizationId,
        dateRange
      );

      res.status(200).json({
        success: true,
        data: summary,
      });
    }
  );

  /**
   * @route   GET /api/invoices/overdue
   * @desc    Get overdue invoices
   * @access  Private
   */
  getOverdueInvoices = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;

      const invoices = await invoiceService.getOverdueInvoices(organizationId);

      res.status(200).json({
        success: true,
        count: invoices.length,
        data: invoices,
      });
    }
  );
}

export default new InvoiceController();
