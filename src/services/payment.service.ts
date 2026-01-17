import Stripe from 'stripe';
import config from '../config';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';
import invoiceService from './invoice.service';

class PaymentService {
  private stripe: Stripe;

  constructor() {
    if (!config.stripe.secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    
    // Validate Stripe key format
    if (!config.stripe.secretKey.startsWith('sk_')) {
      throw new Error('Invalid STRIPE_SECRET_KEY format. Must start with sk_test_ or sk_live_');
    }
    
    // Remove any whitespace or quotes that might have been accidentally included
    const cleanKey = config.stripe.secretKey.trim().replace(/[\"']/g, '');
    
    this.stripe = new Stripe(cleanKey, {
      apiVersion: '2025-12-15.clover',
    });
    
    logger.info(`Stripe initialized with key: ${cleanKey.substring(0, 12)}...${cleanKey.slice(-4)}`);
  }

  /**
   * Create a payment intent for an invoice
   */
  async createPaymentIntent(invoiceId: number): Promise<Stripe.PaymentIntent> {
    try {
      // Fetch invoice details
      const invoice = await invoiceService.getInvoiceById(invoiceId);

      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      if (invoice.paymentStatus === 'PAID') {
        throw new AppError('Invoice is already paid', 400);
      }

      // Amount should be in smallest currency unit (paise for INR)
      const amount = Math.round(Number(invoice.totalAmount) * 100);

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: 'inr',
        metadata: {
          invoiceId: invoice.id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          customerId: invoice.customerId.toString(),
        },
        description: `Payment for Invoice ${invoice.invoiceNumber}`,
      });

      logger.info(`Payment intent created: ${paymentIntent.id} for invoice ${invoice.invoiceNumber}`);

      return paymentIntent;
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create payment intent', 500);
    }
  }

  /**
   * Retrieve payment intent by ID
   */
  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      logger.error('Error retrieving payment intent:', error);
      throw new AppError('Failed to retrieve payment intent', 500);
    }
  }

  /**
   * Confirm payment intent
   */
  async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
      logger.info(`Payment intent confirmed: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Error confirming payment intent:', error);
      throw new AppError('Failed to confirm payment intent', 500);
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload: string | Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new AppError('Webhook secret not configured', 500);
    }

    try {
      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      logger.info(`Webhook received: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const invoiceId = paymentIntent.metadata.invoiceId;

          if (invoiceId) {
            // Update invoice payment status
            logger.info(`Payment succeeded for invoice ${invoiceId}`);
            // TODO: Add method to update invoice payment status
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const invoiceId = paymentIntent.metadata.invoiceId;

          if (invoiceId) {
            logger.error(`Payment failed for invoice ${invoiceId}`);
          }
          break;
        }

        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Webhook error:', error);
      throw new AppError('Webhook verification failed', 400);
    }
  }

  /**
   * Create refund for a payment
   */
  async createRefund(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    try {
      const refundData: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to paise
      }

      const refund = await this.stripe.refunds.create(refundData);
      logger.info(`Refund created: ${refund.id} for payment ${paymentIntentId}`);

      return refund;
    } catch (error) {
      logger.error('Error creating refund:', error);
      throw new AppError('Failed to create refund', 500);
    }
  }

  /**
   * Get publishable key for frontend
   */
  getPublishableKey(): string {
    return config.stripe.publishableKey;
  }
}

export default new PaymentService();
