// src/routes/admin.js
// All routes protected by auth + rbac('admin')

const router = require('express').Router();
const auth   = require('../middleware/auth');
const rbac   = require('../middleware/rbac');

const {
  getDashboardStats,
  getKYCQueue,
  verifyHospital,
  getReviewQueue,
  moderateReview,
  getAllSubscriptions,
  toggleFeatured,
  verifySuccessRate,
  getAllUsers,
  deactivateUser,
  getPlatformAnalytics,
} = require('../controllers/adminController');

// Apply auth + admin role to ALL admin routes
router.use(auth, rbac('admin'));

// ── Dashboard ──────────────────────────────────────────────────
// GET  /api/admin/stats              → Platform overview stats
router.get('/stats',                  getDashboardStats);

// GET  /api/admin/analytics          → Revenue, cities, trends
router.get('/analytics',              getPlatformAnalytics);

// ── KYC / Hospital Verification ───────────────────────────────
// GET  /api/admin/hospitals/pending  → KYC queue (filter by status)
router.get('/hospitals/pending',      getKYCQueue);

// POST /api/admin/hospitals/:id/verify        → Approve or Reject KYC
router.post('/hospitals/:id/verify',  verifyHospital);

// POST /api/admin/hospitals/:id/feature       → Toggle featured
router.post('/hospitals/:id/feature', toggleFeatured);

// POST /api/admin/hospitals/:id/verify-rate   → Approve success rate
router.post('/hospitals/:id/verify-rate', verifySuccessRate);

// ── Review Moderation ──────────────────────────────────────────
// GET  /api/admin/reviews/pending    → Review queue
router.get('/reviews/pending',        getReviewQueue);

// POST /api/admin/reviews/:id/moderate → Approve or Reject review
router.post('/reviews/:id/moderate',  moderateReview);

// ── Subscriptions ──────────────────────────────────────────────
// GET  /api/admin/subscriptions      → All subscriptions (filter by status)
router.get('/subscriptions',          getAllSubscriptions);

// ── Users ──────────────────────────────────────────────────────
// GET   /api/admin/users             → All users (filter by role)
router.get('/users',                  getAllUsers);

// PATCH /api/admin/users/:id/deactivate → Activate / deactivate user
router.patch('/users/:id/deactivate', deactivateUser);

module.exports = router;
