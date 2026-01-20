import { Router, Response, NextFunction, Request } from 'express';
import stripeService from '../services/stripe.service';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createPaymentIntentSchema = z.object({
  body: z.object({
    customerId: z.number().int().positive().optional(), // Optional for walk-in customers
    invoiceId: z.number().int().positive().optional(),
    amount: z.number().positive('Amount must be greater than 0'),
    paymentMethodTypes: z.array(z.enum(['card'])).optional(),
    description: z.string().optional(),
  }),
});

const confirmPaymentSchema = z.object({
  body: z.object({
    paymentIntentId: z.string().min(1, 'Payment intent ID is required'),
    paymentMethodId: z.string().optional(),
  }),
});

const cancelPaymentSchema = z.object({
  params: z.object({
    paymentIntentId: z.string().min(1),
  }),
});

const refundSchema = z.object({
  body: z.object({
    paymentIntentId: z.string().min(1, 'Payment intent ID is required'),
    amount: z.number().positive().optional(),
    reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
  }),
});

/**
 * @route   GET /api/stripe/config
 * @desc    Get Stripe publishable key for frontend
 * @access  Private
 */
router.get(
  '/config',
  authenticate,
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const publishableKey = stripeService.getPublishableKey();
      const isConfigured = stripeService.isConfigured();
      
      res.json({
        success: true,
        data: {
          publishableKey,
          isConfigured,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/stripe/payment-intent
 * @desc    Create a new payment intent for card/UPI payment
 * @access  Private
 */
router.post(
  '/payment-intent',
  authenticate,
  validate(createPaymentIntentSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }

      const result = await stripeService.createPaymentIntent({
        organizationId: req.user.organizationId,
        ...req.body,
      });

      res.status(201).json({
        success: true,
        message: 'Payment intent created',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/stripe/confirm
 * @desc    Confirm a payment intent
 * @access  Private
 */
router.post(
  '/confirm',
  authenticate,
  validate(confirmPaymentSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { paymentIntentId, paymentMethodId } = req.body;
      const result = await stripeService.confirmPaymentIntent(paymentIntentId, paymentMethodId);

      res.json({
        success: true,
        message: 'Payment confirmed',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/stripe/payment-intent/:paymentIntentId
 * @desc    Get payment intent status
 * @access  Private
 */
router.get(
  '/payment-intent/:paymentIntentId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await stripeService.getPaymentIntentStatus(req.params.paymentIntentId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/stripe/cancel/:paymentIntentId
 * @desc    Cancel a payment intent
 * @access  Private
 */
router.post(
  '/cancel/:paymentIntentId',
  authenticate,
  validate(cancelPaymentSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await stripeService.cancelPaymentIntent(req.params.paymentIntentId);

      res.json({
        success: true,
        message: 'Payment cancelled',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/stripe/refund
 * @desc    Create a refund for a payment
 * @access  Private (Admin+ only)
 */
router.post(
  '/refund',
  authenticate,
  authorize('OWNER', 'ADMIN', 'ACCOUNTANT'),
  validate(refundSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { paymentIntentId, amount, reason } = req.body;
      const result = await stripeService.createRefund(paymentIntentId, amount, reason);

      res.json({
        success: true,
        message: 'Refund created',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/stripe/webhook
 * @desc    Handle Stripe webhook events
 * @access  Public (verified by Stripe signature)
 */
router.post(
  '/webhook',
  // Use raw body for webhook signature verification
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

      if (!webhookSecret) {
        throw new AppError('Webhook secret not configured', 500);
      }

      const result = await stripeService.handleWebhook(req.body, signature, webhookSecret);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/stripe/payments
 * @desc    Get all Stripe payments for organization
 * @access  Private
 */
router.get(
  '/payments',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }

      const { status, customerId, invoiceId, page, limit } = req.query;

      const result = await stripeService.getStripePayments(req.user.organizationId, {
        status: status as string,
        customerId: customerId ? parseInt(customerId as string) : undefined,
        invoiceId: invoiceId ? parseInt(invoiceId as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/stripe/payments/:id
 * @desc    Get Stripe payment by ID
 * @access  Private
 */
router.get(
  '/payments/:id',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }

      const result = await stripeService.getStripePaymentById(
        req.user.organizationId,
        parseInt(req.params.id)
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/stripe/invoice/:invoiceId/pay
 * @desc    Create payment intent for a specific invoice
 * @access  Private
 */
router.post(
  '/invoice/:invoiceId/pay',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }

      const invoiceId = parseInt(req.params.invoiceId);
      const { paymentMethodTypes } = req.body;

      // Get invoice details
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId: req.user.organizationId },
        include: { customer: true },
      });

      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      if (invoice.paymentStatus === 'PAID') {
        throw new AppError('Invoice is already paid', 400);
      }

      // Calculate remaining amount
      const dueAmount = Number(invoice.totalAmount) - Number(invoice.amountPaid);

      const result = await stripeService.createPaymentIntent({
        organizationId: req.user.organizationId,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        amount: dueAmount,
        paymentMethodTypes: paymentMethodTypes || ['card'],
        description: `Payment for Invoice ${invoice.invoiceNumber}`,
      });

      res.status(201).json({
        success: true,
        message: 'Payment intent created for invoice',
        data: {
          ...result,
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: Number(invoice.totalAmount),
            amountPaid: Number(invoice.amountPaid),
            dueAmount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
