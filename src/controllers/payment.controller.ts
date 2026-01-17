import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import paymentService from '../services/payment.service';
import logger from '../config/logger';

export class PaymentController {
  /**
   * @route   POST /api/payments/create-intent
   * @desc    Create payment intent for an invoice
   * @access  Private
   */
  createPaymentIntent = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const { invoiceId } = req.body;

      logger.info(`Creating payment intent for invoice ${invoiceId}`);

      const paymentIntent = await paymentService.createPaymentIntent(invoiceId);

      res.status(200).json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        },
      });
    }
  );

  /**
   * @route   GET /api/payments/intent/:id
   * @desc    Retrieve payment intent by ID
   * @access  Private
   */
  getPaymentIntent = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const { id } = req.params;

      const paymentIntent = await paymentService.retrievePaymentIntent(id);

      res.status(200).json({
        success: true,
        data: paymentIntent,
      });
    }
  );

  /**
   * @route   POST /api/payments/confirm/:id
   * @desc    Confirm payment intent
   * @access  Private
   */
  confirmPaymentIntent = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const { id } = req.params;

      const paymentIntent = await paymentService.confirmPaymentIntent(id);

      res.status(200).json({
        success: true,
        data: paymentIntent,
      });
    }
  );

  /**
   * @route   POST /api/payments/webhook
   * @desc    Handle Stripe webhook events
   * @access  Public (with signature verification)
   */
  handleWebhook = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        res.status(400).json({
          success: false,
          message: 'Missing stripe-signature header',
        });
        return;
      }

      await paymentService.handleWebhook(req.body, signature);

      res.status(200).json({ received: true });
    }
  );

  /**
   * @route   POST /api/payments/refund
   * @desc    Create refund for a payment
   * @access  Private (Admin only)
   */
  createRefund = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const { paymentIntentId, amount } = req.body;

      logger.info(`Creating refund for payment ${paymentIntentId}`);

      const refund = await paymentService.createRefund(paymentIntentId, amount);

      res.status(200).json({
        success: true,
        data: refund,
      });
    }
  );

  /**
   * @route   GET /api/payments/config
   * @desc    Get Stripe publishable key
   * @access  Public
   */
  getConfig = asyncHandler(
    async (_req: Request, res: Response) => {
      const publishableKey = paymentService.getPublishableKey();

      res.status(200).json({
        success: true,
        data: {
          publishableKey,
        },
      });
    }
  );
}

export default new PaymentController();
