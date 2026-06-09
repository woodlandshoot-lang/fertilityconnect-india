// src/services/razorpayService.js

const Razorpay = require('razorpay');
const crypto   = require('crypto');
const env      = require('../config/env');

// Init Razorpay instance
const razorpay = new Razorpay({
  key_id:     env.razorpay.keyId,
  key_secret: env.razorpay.keySecret,
});

// ── PLAN CONFIG ───────────────────────────────────────────────
// All amounts in paise (₹ × 100)
const PLANS = {
  basic: {
    id:          'basic',
    name:        'Basic Plan',
    amount:      299900,     // ₹2,999/month
    leads_quota: 5,
    description: '5 leads/month, 1 city, basic analytics',
  },
  pro: {
    id:          'pro',
    name:        'Pro Plan',
    amount:      799900,     // ₹7,999/month
    leads_quota: 20,
    description: '20 leads/month, 3 cities, featured badge',
  },
  premium: {
    id:          'premium',
    name:        'Premium Plan',
    amount:      1499900,    // ₹14,999/month
    leads_quota: 9999,       // unlimited
    description: 'Unlimited leads, all cities, top placement',
  },
};

// Lead unlock pricing tiers (paise)
const LEAD_PRICES = {
  high:     69900,   // ₹699  — budget > ₹2L
  standard: 49900,   // ₹499  — budget ₹1L–₹2L
  budget:   29900,   // ₹299  — budget < ₹1L
};

// ── GET ALL PLANS ─────────────────────────────────────────────
const getPlans = () => Object.values(PLANS);

// ── CALCULATE LEAD PRICE ──────────────────────────────────────
const calcLeadPrice = (budgetMax) => {
  if (budgetMax >= 200000) return LEAD_PRICES.high;
  if (budgetMax >= 100000) return LEAD_PRICES.standard;
  return LEAD_PRICES.budget;
};

// ── CREATE RAZORPAY ORDER (for lead unlock / featured) ────────
const createOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
  if (env.nodeEnv === 'development') {
    // Mock order in dev
    console.log(`💳 [DEV] Mock Razorpay order: ₹${amount / 100}`);
    return {
      id:       'order_dev_' + Date.now(),
      amount,
      currency,
      receipt,
      status:   'created',
      dev_mode: true,
    };
  }

  const order = await razorpay.orders.create({
    amount,
    currency,
    receipt:  receipt || `rcpt_${Date.now()}`,
    notes,
  });
  return order;
};

// ── CREATE RAZORPAY SUBSCRIPTION (monthly plan) ───────────────
const createSubscription = async ({ planId, totalCount = 12, quantity = 1, notes = {} }) => {
  if (env.nodeEnv === 'development') {
    console.log(`💳 [DEV] Mock Razorpay subscription: plan=${planId}`);
    return {
      id:          'sub_dev_' + Date.now(),
      plan_id:     'plan_dev_' + planId,
      status:      'created',
      total_count: totalCount,
      dev_mode:    true,
    };
  }

  const subscription = await razorpay.subscriptions.create({
    plan_id:     planId,
    total_count: totalCount,
    quantity,
    notes,
  });
  return subscription;
};

// ── VERIFY PAYMENT SIGNATURE ──────────────────────────────────
// Validates Razorpay webhook / payment signature
const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  const body      = orderId + '|' + paymentId;
  const expected  = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(body)
    .digest('hex');
  return expected === signature;
};

// ── VERIFY WEBHOOK SIGNATURE ──────────────────────────────────
const verifyWebhookSignature = (rawBody, signature) => {
  const expected = crypto
    .createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
};

// ── FETCH PAYMENT DETAILS ─────────────────────────────────────
const fetchPayment = async (paymentId) => {
  if (env.nodeEnv === 'development') {
    return { id: paymentId, status: 'captured', amount: 49900 };
  }
  return await razorpay.payments.fetch(paymentId);
};

module.exports = {
  PLANS,
  LEAD_PRICES,
  getPlans,
  calcLeadPrice,
  createOrder,
  createSubscription,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
};
