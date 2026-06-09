// src/routes/auth.js

const router = require('express').Router();
const auth   = require('../middleware/auth');
const {
  validate,
  registerSchema,
  loginSchema,
  otpSendSchema,
  otpVerifySchema,
  refreshSchema,
} = require('../utils/validators');

const {
  register,
  login,
  sendOTP,
  verifyOTP,
  refreshToken,
  logout,
  getMe,
} = require('../controllers/authController');

// ── Public Routes ──────────────────────────────────────────────

// POST /api/auth/register  — Patient or Hospital signup
router.post('/register', validate(registerSchema), register);

// POST /api/auth/login  — Login with phone/email + password
router.post('/login', validate(loginSchema), login);

// POST /api/auth/otp/send  — Send OTP to phone
router.post('/otp/send', validate(otpSendSchema), sendOTP);

// POST /api/auth/otp/verify  — Verify OTP (OTP login)
router.post('/otp/verify', validate(otpVerifySchema), verifyOTP);

// POST /api/auth/refresh  — Get new access token
router.post('/refresh', validate(refreshSchema), refreshToken);

// ── Protected Routes ───────────────────────────────────────────

// GET /api/auth/me  — Get logged-in user profile
router.get('/me', auth, getMe);

// POST /api/auth/logout
router.post('/logout', auth, logout);

module.exports = router;
