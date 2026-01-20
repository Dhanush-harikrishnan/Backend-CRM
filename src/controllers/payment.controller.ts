import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import paymentService from '../services/payment.service';
import logger from '../config/logger';

export class PaymentController {
  /**
   * @route   POST /api/payments
   * @desc    Create a new cash payment
   * @access  Private
   */
  createPayment = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;

      logger.info(`Creating payment for invoice ${req.body.invoiceId} by user ${req.user?.email}`);

      const payment = await paymentService.createPayment({
        ...req.body,
        organizationId,
      });

      res.status(201).json({
        success: true,
        message: 'Payment recorded successfully',
        data: payment,
      });
    }
  );

  /**
   * @route   GET /api/payments
   * @desc    Get all payments with filters
   * @access  Private
   */
  getAllPayments = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const {
        dateFrom,
        dateTo,
        customerId,
        invoiceId,
        paymentMode,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      } = req.query;

      const result = await paymentService.getAllPayments({
        organizationId,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        customerId: customerId ? parseInt(customerId as string, 10) : undefined,
        invoiceId: invoiceId ? parseInt(invoiceId as string, 10) : undefined,
        paymentMode: paymentMode as any,
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
   * @route   GET /api/payments/:id
   * @desc    Get payment by ID
   * @access  Private
   */
  getPaymentById = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);

      const payment = await paymentService.getPaymentById(organizationId, id);

      res.status(200).json({
        success: true,
        data: payment,
      });
    }
  );

  /**
   * @route   PUT /api/payments/:id
   * @desc    Update payment
   * @access  Private
   */
  updatePayment = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);

      const payment = await paymentService.updatePayment(organizationId, id, req.body);

      res.status(200).json({
        success: true,
        message: 'Payment updated successfully',
        data: payment,
      });
    }
  );

  /**
   * @route   DELETE /api/payments/:id
   * @desc    Delete payment
   * @access  Private (Admin only)
   */
  deletePayment = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id, 10);

      await paymentService.deletePayment(organizationId, id);

      res.status(200).json({
        success: true,
        message: 'Payment deleted successfully',
      });
    }
  );

  /**
   * @route   POST /api/payments/bulk
   * @desc    Record bulk payment for multiple invoices
   * @access  Private
   */
  recordBulkPayment = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;

      const result = await paymentService.recordBulkPayment({
        ...req.body,
        organizationId,
      });

      res.status(201).json({
        success: true,
        message: 'Bulk payment recorded successfully',
        data: result,
      });
    }
  );

  /**
   * @route   GET /api/payments/summary
   * @desc    Get payment summary
   * @access  Private
   */
  getPaymentSummary = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const { startDate, endDate } = req.query;

      const dateRange = startDate && endDate ? {
        from: new Date(startDate as string),
        to: new Date(endDate as string)
      } : undefined;

      const summary = await paymentService.getPaymentSummary(
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
   * @route   GET /api/payments/recent
   * @desc    Get recent payments
   * @access  Private
   */
  getRecentPayments = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const payments = await paymentService.getRecentPayments(organizationId, limit);

      res.status(200).json({
        success: true,
        count: payments.length,
        data: payments,
      });
    }
  );

  /**
   * @route   GET /api/payments/customer/:id
   * @desc    Get customer payments
   * @access  Private
   */
  getCustomerPayments = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const customerId = parseInt(req.params.id, 10);

      const payments = await paymentService.getCustomerPayments(organizationId, customerId);

      res.status(200).json({
        success: true,
        count: payments.length,
        data: payments,
      });
    }
  );

  /**
   * @route   GET /api/payments/customer/:id/unpaid-invoices
   * @desc    Get unpaid invoices for a customer
   * @access  Private
   */
  getUnpaidInvoices = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const customerId = parseInt(req.params.id, 10);

      const invoices = await paymentService.getUnpaidInvoices(organizationId, customerId);

      res.status(200).json({
        success: true,
        count: invoices.length,
        data: invoices,
      });
    }
  );
}

export default new PaymentController();
