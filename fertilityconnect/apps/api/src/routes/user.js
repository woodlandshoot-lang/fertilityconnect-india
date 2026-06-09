// src/routes/user.js

const router = require('express').Router();
const auth   = require('../middleware/auth');
const {
  getProfile, updateProfile, changePassword,
  forgotPassword, resetPassword,
  saveHospital, unsaveHospital, getSavedHospitals,
  deleteAccount,
} = require('../controllers/userController');

// ── Password (Public — no auth needed) ────────────────────────
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

// ── Profile (Auth required) ───────────────────────────────────
router.get('/profile',          auth, getProfile);
router.put('/profile',          auth, updateProfile);
router.put('/change-password',  auth, changePassword);
router.delete('/account',       auth, deleteAccount);

// ── Saved Hospitals ───────────────────────────────────────────
router.get('/saved',                    auth, getSavedHospitals);
router.post('/saved/:hospitalId',       auth, saveHospital);
router.delete('/saved/:hospitalId',     auth, unsaveHospital);

module.exports = router;
