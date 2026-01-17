#!/usr/bin/env node

/**
 * Stripe Configuration Validator
 * Run this script to test your Stripe API keys
 */

require('dotenv').config();
const Stripe = require('stripe');

const secretKey = process.env.STRIPE_SECRET_KEY;
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

console.log('\n🔍 Validating Stripe Configuration...\n');

// Check if keys exist
if (!secretKey) {
  console.error('❌ STRIPE_SECRET_KEY is missing in .env file');
  process.exit(1);
}

if (!publishableKey) {
  console.error('❌ STRIPE_PUBLISHABLE_KEY is missing in .env file');
  process.exit(1);
}

// Check key formats
console.log(`✓ Secret Key format: ${secretKey.substring(0, 12)}...${secretKey.slice(-4)}`);
console.log(`✓ Publishable Key format: ${publishableKey.substring(0, 12)}...${publishableKey.slice(-4)}`);

if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
  console.error('❌ STRIPE_SECRET_KEY has invalid format. Must start with sk_test_ or sk_live_');
  process.exit(1);
}

if (!publishableKey.startsWith('pk_test_') && !publishableKey.startsWith('pk_live_')) {
  console.error('❌ STRIPE_PUBLISHABLE_KEY has invalid format. Must start with pk_test_ or pk_live_');
  process.exit(1);
}

// Check webhook secret
if (!webhookSecret || webhookSecret === 'whsec_1234567890abcdef1234567890abcdef') {
  console.warn('⚠️  STRIPE_WEBHOOK_SECRET is using placeholder value');
  console.warn('   Get real secret from: https://dashboard.stripe.com/test/webhooks');
} else {
  console.log('✓ Webhook secret configured');
}

// Test API connection
console.log('\n🔌 Testing Stripe API connection...\n');

const stripe = new Stripe(secretKey, {
  apiVersion: '2025-12-15.clover',
});

async function testConnection() {
  try {
    // Try to retrieve account details
    const account = await stripe.accounts.retrieve();
    console.log(`✅ Connected to Stripe successfully!`);
    console.log(`   Account ID: ${account.id}`);
    console.log(`   Environment: ${secretKey.startsWith('sk_test_') ? 'TEST MODE' : 'LIVE MODE'}`);
    console.log(`   Country: ${account.country}`);
    
    // Test creating a small payment intent (won't charge)
    console.log('\n💳 Testing payment intent creation...');
    const intent = await stripe.paymentIntents.create({
      amount: 100, // ₹1.00
      currency: 'inr',
      metadata: { test: 'validation' },
    });
    console.log(`✅ Payment intent created: ${intent.id}`);
    console.log(`   Status: ${intent.status}`);
    
    console.log('\n✅ All Stripe tests passed! Configuration is correct.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Stripe API test failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Type: ${error.type}`);
    console.error('\n💡 Possible solutions:');
    console.error('   1. Check if your API key is correct');
    console.error('   2. Verify key in Stripe Dashboard: https://dashboard.stripe.com/test/apikeys');
    console.error('   3. Make sure you copied the full key without spaces');
    console.error('   4. Try regenerating the key if it\'s old\n');
    process.exit(1);
  }
}

testConnection();
