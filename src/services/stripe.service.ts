import Stripe from 'stripe';
import prisma from '../config/database';
import config from '../config';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';
import { StripePayment } from '@prisma/client';

// Initialize Stripe with API key
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-12-15.clover',
});

export interface CreatePaymentIntentInput {
  organizationId: string;
  customerId: number;
  invoiceId?: number;
  amount: number; // Amount in INR (will be converted to paise)
  currency?: string;
  paymentMethodTypes?: ('card' | 'upi')[];
  description?: string;
  metadata?: Record<string, string>;
}

export interface ConfirmPaymentInput {
  organizationId: string;
  paymentIntentId: string;
  paymentMethodId?: string;
}

class StripeService {
  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return !!config.stripe.secretKey && config.stripe.secretKey !== '';
  }

  /**
   * Create a payment intent for card/UPI payment
   */
  async createPaymentIntent(data: CreatePaymentIntentInput) {
    if (!this.isConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to environment.', 500);
    }

    const { organizationId, customerId, invoiceId, amount, currency = 'inr', paymentMethodTypes = ['card', 'upi'], description, metadata } = data;

    // Validate customer exists
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      include: {
        organization: {
          select: { name: true, email: true },
        },
      },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Validate invoice if provided
    let invoice = null;
    if (invoiceId) {
      invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId, customerId },
      });

      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      if (invoice.paymentStatus === 'PAID') {
        throw new AppError('Invoice is already fully paid', 400);
      }
    }

    // Convert amount to smallest currency unit (paise for INR)
    const amountInSmallestUnit = Math.round(amount * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInSmallestUnit,
      currency,
      payment_method_types: paymentMethodTypes,
      description: description || `Payment for ${customer.organization.name}`,
      metadata: {
        organizationId,
        customerId: customerId.toString(),
        invoiceId: invoiceId?.toString() || '',
        customerName: customer.displayName,
        customerEmail: customer.email || '',
        ...metadata,
      },
    });

    // Store payment intent in database
    const stripePayment = await prisma.stripePayment.create({
      data: {
        organizationId,
        stripePaymentIntentId: paymentIntent.id,
        amount: amountInSmallestUnit,
        currency,
        status: 'PENDING',
        invoiceId,
        customerId,
        metadata: {
          clientSecret: paymentIntent.client_secret,
          paymentMethodTypes,
        },
      },
    });

    logger.info(`Created payment intent ${paymentIntent.id} for customer ${customerId}`);

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: amount,
      amountInPaise: amountInSmallestUnit,
      currency,
      status: paymentIntent.status,
      stripePaymentId: stripePayment.id,
    };
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(paymentIntentId: string, paymentMethodId?: string) {
    if (!this.isConfigured()) {
      throw new AppError('Stripe is not configured', 500);
    }

    const confirmParams: Stripe.PaymentIntentConfirmParams = {};
    if (paymentMethodId) {
      confirmParams.payment_method = paymentMethodId;
    }

    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, confirmParams);

    // Update database record
    await this.updatePaymentStatus(paymentIntentId, paymentIntent);

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      paymentMethod: paymentIntent.payment_method,
    };
  }

  /**
   * Get payment intent status
   */
  async getPaymentIntentStatus(paymentIntentId: string) {
    if (!this.isConfigured()) {
      throw new AppError('Stripe is not configured', 500);
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100, // Convert back to INR
      currency: paymentIntent.currency,
      paymentMethod: paymentIntent.payment_method,
      metadata: paymentIntent.metadata,
    };
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string) {
    if (!this.isConfigured()) {
      throw new AppError('Stripe is not configured', 500);
    }

    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

    // Update database record
    await prisma.stripePayment.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: { status: 'CANCELLED' },
    });

    logger.info(`Cancelled payment intent ${paymentIntentId}`);

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(paymentIntentId: string, amount?: number, reason?: string) {
    if (!this.isConfigured()) {
      throw new AppError('Stripe is not configured', 500);
    }

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100); // Convert to paise
    }

    if (reason) {
      refundParams.reason = reason as Stripe.RefundCreateParams.Reason;
    }

    const refund = await stripe.refunds.create(refundParams);

    // Update database record
    await prisma.stripePayment.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: { status: 'REFUNDED' },
    });

    logger.info(`Created refund for payment intent ${paymentIntentId}`);

    return {
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
      paymentIntentId,
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload: string | Buffer, signature: string, webhookSecret: string) {
    if (!this.isConfigured()) {
      throw new AppError('Stripe is not configured', 500);
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new AppError(`Webhook Error: ${err.message}`, 400);
    }

    logger.info(`Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentCancelled(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await this.handleRefund(event.data.object as Stripe.Charge);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    return { received: true, type: event.type };
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    const { id: paymentIntentId, metadata, amount, payment_method } = paymentIntent;

    logger.info(`Payment succeeded: ${paymentIntentId}`);

    // Update stripe payment record
    await this.updatePaymentStatus(paymentIntentId, paymentIntent);

    // If linked to an invoice, create payment record and update invoice
    if (metadata.invoiceId && metadata.organizationId && metadata.customerId) {
      await this.createPaymentFromStripe(
        metadata.organizationId,
        parseInt(metadata.customerId),
        parseInt(metadata.invoiceId),
        amount / 100, // Convert back to INR
        paymentIntentId,
        this.getPaymentMode(payment_method as string)
      );
    }
  }

  /**
   * Handle payment failure
   */
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
    const { id: paymentIntentId, last_payment_error } = paymentIntent;

    logger.error(`Payment failed: ${paymentIntentId} - ${last_payment_error?.message}`);

    await prisma.stripePayment.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: 'FAILED',
        failureCode: last_payment_error?.code || null,
        failureMessage: last_payment_error?.message || null,
      },
    });
  }

  /**
   * Handle cancelled payment
   */
  private async handlePaymentCancelled(paymentIntent: Stripe.PaymentIntent) {
    const { id: paymentIntentId } = paymentIntent;

    logger.info(`Payment cancelled: ${paymentIntentId}`);

    await prisma.stripePayment.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Handle refund
   */
  private async handleRefund(charge: Stripe.Charge) {
    const paymentIntentId = charge.payment_intent as string;

    logger.info(`Payment refunded: ${paymentIntentId}`);

    await prisma.stripePayment.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: { status: 'REFUNDED' },
    });
  }

  /**
   * Update payment status in database
   */
  private async updatePaymentStatus(paymentIntentId: string, paymentIntent: Stripe.PaymentIntent) {
    const statusMap: Record<string, 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'> = {
      requires_payment_method: 'PENDING',
      requires_confirmation: 'PENDING',
      requires_action: 'PROCESSING',
      processing: 'PROCESSING',
      succeeded: 'SUCCEEDED',
      canceled: 'CANCELLED',
    };

    const status = statusMap[paymentIntent.status] || 'PENDING';
    const paymentMethod = paymentIntent.payment_method_types?.[0] || null;

    await prisma.stripePayment.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status,
        paymentMethod,
        completedAt: status === 'SUCCEEDED' ? new Date() : null,
        receiptUrl: (paymentIntent as any).charges?.data?.[0]?.receipt_url || null,
      },
    });
  }

  /**
   * Create payment record from Stripe payment
   */
  private async createPaymentFromStripe(
    organizationId: string,
    customerId: number,
    invoiceId: number,
    amount: number,
    stripePaymentIntentId: string,
    paymentMode: 'CARD' | 'UPI' | 'NETBANKING'
  ) {
    // Import payment service dynamically to avoid circular dependency
    const paymentService = (await import('./payment.service')).default;

    try {
      const payment = await paymentService.createPayment({
        organizationId,
        customerId,
        invoiceId,
        amount,
        paymentMode,
        referenceNumber: stripePaymentIntentId,
        notes: `Stripe payment via ${paymentMode}`,
      });

      // Link stripe payment to payment record
      await prisma.stripePayment.updateMany({
        where: { stripePaymentIntentId },
        data: { paymentId: payment.id },
      });

      logger.info(`Created payment ${payment.paymentNumber} from Stripe payment ${stripePaymentIntentId}`);
    } catch (error) {
      logger.error(`Failed to create payment from Stripe: ${error}`);
    }
  }

  /**
   * Get payment mode from Stripe payment method
   */
  private getPaymentMode(_paymentMethodId: string | null): 'CARD' | 'UPI' | 'NETBANKING' {
    // Default to CARD, actual type would be determined by payment method details
    return 'CARD';
  }

  /**
   * Get all Stripe payments for organization
   */
  async getStripePayments(
    organizationId: string,
    filters?: {
      status?: string;
      customerId?: number;
      invoiceId?: number;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (filters?.status) where.status = filters.status;
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.invoiceId) where.invoiceId = filters.invoiceId;

    const [payments, total] = await Promise.all([
      prisma.stripePayment.findMany({
        where,
        include: {
          customer: { select: { displayName: true, email: true } },
          invoice: { select: { invoiceNumber: true, totalAmount: true } },
          payment: { select: { paymentNumber: true, amount: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.stripePayment.count({ where }),
    ]);

    return {
      data: payments.map((p: StripePayment) => ({
        ...p,
        amount: p.amount / 100, // Convert to INR
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get Stripe payment by ID
   */
  async getStripePaymentById(organizationId: string, id: number) {
    const payment = await prisma.stripePayment.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        invoice: true,
        payment: true,
      },
    });

    if (!payment) {
      throw new AppError('Stripe payment not found', 404);
    }

    return {
      ...payment,
      amount: payment.amount / 100,
    };
  }

  /**
   * Get publishable key for frontend
   */
  getPublishableKey() {
    return config.stripe.publishableKey;
  }
}

export default new StripeService();
