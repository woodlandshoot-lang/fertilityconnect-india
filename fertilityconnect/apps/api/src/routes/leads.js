// src/routes/leads.js

const router   = require('express').Router();
const auth     = require('../middleware/auth');
const rbac     = require('../middleware/rbac');
const kycGuard = require('../middleware/kycGuard');
const { validate, submitLeadSchema } = require('../utils/leadValidators');

const {
  submitLead,
  getMyLeads,
  withdrawLead,
  getAvailableLeads,
  unlockLead,
  getUnlockedLeads,
  getLeadPrice,
  getNotifications,
  markNotificationRead,
} = require('../controllers/leadController');

// ── Patient Routes ─────────────────────────────────────────────

// POST /api/leads               → Submit consultation request
router.post('/',
  auth, rbac('client'),
  validate(submitLeadSchema),
  submitLead
);

// GET /api/leads/my             → My submitted leads
router.get('/my',
  auth, rbac('client'),
  getMyLeads
);

// DELETE /api/leads/:id         → Withdraw my lead
router.delete('/:id',
  auth, rbac('client'),
  withdrawLead
);

// ── Hospital Routes ────────────────────────────────────────────

// GET /api/leads/available      → Browse leads (masked)
router.get('/available',
  auth, rbac('hospital'), kycGuard,
  getAvailableLeads
);

// GET /api/leads/unlocked       → All unlocked leads (with decrypted data)
router.get('/unlocked',
  auth, rbac('hospital'), kycGuard,
  getUnlockedLeads
);

// GET /api/leads/:id/price      → Get unlock price for a lead
router.get('/:id/price',
  auth, rbac('hospital'), kycGuard,
  getLeadPrice
);

// POST /api/leads/:id/unlock    → Unlock lead after payment
router.post('/:id/unlock',
  auth, rbac('hospital'), kycGuard,
  unlockLead
);

// ── Shared (Patient + Hospital) ────────────────────────────────

// GET /api/leads/notifications
router.get('/notifications',
  auth,
  getNotifications
);

// PATCH /api/leads/notifications/:id/read
router.patch('/notifications/:id/read',
  auth,
  markNotificationRead
);

module.exports = router;
