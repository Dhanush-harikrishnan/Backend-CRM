# Stripe Payment Integration Guide

## Overview
This API integrates Stripe payment processing for invoice payments with full webhook support for real-time payment status updates.

## Features
- 🔐 Secure payment intent creation
- 💳 Support for Indian Rupee (INR) currency
- 🔄 Real-time payment status updates via webhooks
- ♻️ Refund support for admin users
- 📊 Payment tracking with invoice metadata

## Setup

### 1. Get Stripe API Keys
1. Sign up at [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to Developers > API keys
3. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
4. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

### 2. Configure Environment Variables
Add to your `.env` file:
```env
STRIPE_SECRET_KEY="sk_test_your_secret_key"
STRIPE_PUBLISHABLE_KEY="pk_test_your_publishable_key"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
```

### 3. Setup Webhook Endpoint
1. Go to Developers > Webhooks in Stripe Dashboard
2. Click "Add endpoint"
3. Enter your webhook URL: `https://yourdomain.com/api/payments/webhook`
4. Select events to listen:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the **Signing Secret** to `STRIPE_WEBHOOK_SECRET`

## API Endpoints

### 1. Get Stripe Config (Public)
```http
GET /api/payments/config
```

**Response:**
```json
{
  "success": true,
  "data": {
    "publishableKey": "pk_test_..."
  }
}
```

### 2. Create Payment Intent (Private)
```http
POST /api/payments/create-intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoiceId": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "paymentIntentId": "pi_xxx"
  }
}
```

### 3. Get Payment Intent (Private)
```http
GET /api/payments/intent/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pi_xxx",
    "amount": 100000,
    "currency": "inr",
    "status": "succeeded",
    "metadata": {
      "invoiceId": "1",
      "invoiceNumber": "INV-2024-00001"
    }
  }
}
```

### 4. Confirm Payment Intent (Private)
```http
POST /api/payments/confirm/:id
Authorization: Bearer <token>
```

### 5. Create Refund (Admin Only)
```http
POST /api/payments/refund
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "paymentIntentId": "pi_xxx",
  "amount": 500.00  // Optional, defaults to full refund
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "re_xxx",
    "amount": 50000,
    "status": "succeeded"
  }
}
```

### 6. Webhook Handler (Public with Signature)
```http
POST /api/payments/webhook
stripe-signature: t=xxx,v1=xxx
```

## Frontend Integration

### React/Next.js Example

#### 1. Install Stripe.js
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

#### 2. Setup Stripe Provider
```tsx
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe('pk_test_your_publishable_key');

export default function App() {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm />
    </Elements>
  );
}
```

#### 3. Payment Component
```tsx
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { useState } from 'react';

function PaymentForm({ invoiceId }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ invoiceId })
      });

      const { data } = await response.json();
      const { clientSecret } = data;

      // Step 2: Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
          }
        }
      );

      if (error) {
        console.error(error.message);
      } else if (paymentIntent.status === 'succeeded') {
        console.log('Payment successful!');
      }
    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit" disabled={!stripe || loading}>
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}
```

## Payment Flow

```
1. User initiates payment for an invoice
   └─> Frontend calls POST /api/payments/create-intent { invoiceId }

2. Backend creates Stripe PaymentIntent
   └─> Returns clientSecret to frontend

3. Frontend uses Stripe.js to collect card details
   └─> Calls stripe.confirmCardPayment(clientSecret, cardDetails)

4. Stripe processes payment and triggers webhook
   └─> Webhook received at POST /api/payments/webhook

5. Backend updates invoice status based on webhook event
   └─> payment_intent.succeeded -> Mark invoice as PAID
   └─> payment_intent.payment_failed -> Log failure
```

## Testing

### Test Cards (Test Mode)
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0027 6000 3184

Use any future expiry date and any 3-digit CVC
```

### Test Webhook Locally
1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks: `stripe listen --forward-to localhost:5000/api/payments/webhook`
4. Trigger test event: `stripe trigger payment_intent.succeeded`

## Security Notes

⚠️ **Important:**
- Never expose `STRIPE_SECRET_KEY` in frontend code
- Always verify webhook signatures using `stripe-signature` header
- Use HTTPS in production for webhook endpoints
- Store payment data only as references (payment_intent_id)
- Never log full card numbers or sensitive payment data

## Amount Conversion
Stripe requires amounts in smallest currency unit:
- INR: ₹100.00 = 10000 paise
- Conversion: `amount_in_paise = amount_in_rupees * 100`

## Error Handling

Common error codes:
- `card_declined` - Payment method declined
- `insufficient_funds` - Card has insufficient funds
- `expired_card` - Card has expired
- `incorrect_cvc` - CVC check failed
- `processing_error` - Try again later

## Production Checklist

- [ ] Replace test keys with live keys (`pk_live_` and `sk_live_`)
- [ ] Enable HTTPS for webhook endpoint
- [ ] Configure webhook endpoint in Stripe Dashboard
- [ ] Add proper error logging and monitoring
- [ ] Implement invoice status update on payment success
- [ ] Set up email notifications for payment events
- [ ] Add rate limiting for payment endpoints
- [ ] Implement idempotency for payment creation
- [ ] Test refund workflow thoroughly

## Resources

- [Stripe Docs](https://stripe.com/docs)
- [Payment Intents API](https://stripe.com/docs/api/payment_intents)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [Testing](https://stripe.com/docs/testing)
- [Stripe.js Reference](https://stripe.com/docs/js)

## Support

For Stripe integration issues:
1. Check Stripe Dashboard > Logs for API errors
2. Verify webhook signatures are correct
3. Test with Stripe CLI locally
4. Review payment intent status in Dashboard
