// src/routes/payments.js

const router   = require('express').Router();
const auth     = require('../middleware/auth');
const rbac     = require('../middleware/rbac');
const kycGuard = require('../middleware/kycGuard');

const {
  getPlansHandler,
  createSubscriptionOrder,
  createLeadUnlockOrder,
  verifyPayment,
  handleWebhook,
  getPaymentHistory,
  getSubscription,
  cancelSubscription,
  createFeaturedOrder,
} = require('../controllers/paymentController');

// ── Public ─────────────────────────────────────────────────────
// GET /api/payments/plans  →  All subscription plan details
router.get('/plans', getPlansHandler);

// ── Razorpay Webhook (raw body — configured in index.js) ───────
// POST /api/payments/webhook
router.post('/webhook', handleWebhook);

// ── Hospital Protected Routes ──────────────────────────────────

// POST /api/payments/subscription  → Create subscription order
router.post('/subscription',
  auth, rbac('hospital'),
  createSubscriptionOrder
);

// POST /api/payments/lead-unlock   → Create lead unlock order
router.post('/lead-unlock',
  auth, rbac('hospital'), kycGuard,
  createLeadUnlockOrder
);

// POST /api/payments/verify        → Verify after checkout
router.post('/verify',
  auth, rbac('hospital'),
  verifyPayment
);

// GET /api/payments/history        → Payment history
router.get('/history',
  auth, rbac('hospital'),
  getPaymentHistory
);

// GET /api/payments/subscription   → Current plan + quota
router.get('/subscription',
  auth, rbac('hospital'),
  getSubscription
);

// POST /api/payments/subscription/cancel → Cancel subscription
router.post('/subscription/cancel',
  auth, rbac('hospital'),
  cancelSubscription
);

// POST /api/payments/featured → Featured listing upgrade
router.post('/featured',
  auth, rbac('hospital'), kycGuard,
  createFeaturedOrder
);

module.exports = router;
