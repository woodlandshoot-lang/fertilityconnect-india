// src/routes/hospitals.js

const router    = require('express').Router();
const auth      = require('../middleware/auth');
const rbac      = require('../middleware/rbac');
const kycGuard  = require('../middleware/kycGuard');

const {
  listHospitals,
  getHospital,
  getByCity,
  searchHospitals,
  getMyProfile,
  updateMyProfile,
  uploadKYC,
  getAnalytics,
} = require('../controllers/hospitalController');

// ── Public Routes ──────────────────────────────────────────────

// GET /api/hospitals                  → List + filter hospitals
router.get('/',               listHospitals);

// GET /api/hospitals/search?q=mumbai  → Full-text search
router.get('/search',         searchHospitals);

// GET /api/hospitals/city/Mumbai      → City landing page (SEO)
router.get('/city/:city',     getByCity);

// ── Hospital Dashboard Routes (protected) ─────────────────────

// GET  /api/hospitals/dashboard/profile   → Own profile
router.get('/dashboard/profile',
  auth, rbac('hospital'),
  getMyProfile
);

// PUT  /api/hospitals/dashboard/profile   → Update profile
router.put('/dashboard/profile',
  auth, rbac('hospital'),
  updateMyProfile
);

// POST /api/hospitals/dashboard/kyc       → Upload KYC doc
router.post('/dashboard/kyc',
  auth, rbac('hospital'),
  uploadKYC
);

// GET  /api/hospitals/dashboard/analytics → Stats
router.get('/dashboard/analytics',
  auth, rbac('hospital'), kycGuard,
  getAnalytics
);

// ── Public: single hospital by slug (MUST be last) ────────────
// GET /api/hospitals/:slug
router.get('/:slug',          getHospital);

module.exports = router;
