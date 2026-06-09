// src/controllers/authController.js

const bcrypt   = require('bcryptjs');
const slugify  = require('slugify');
const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../config/db');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt');
const { generateOTP, saveOTP, verifyOTP, sendOTPviaSMS } = require('../utils/otp');

// ── REGISTER ─────────────────────────────────────────────────
// POST /api/auth/register
const register = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { role, full_name, phone, email, password, hospital_name } = req.body;

    // Check duplicate phone
    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );
    if (existing[0]) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already registered.',
      });
    }

    // Check duplicate email (if provided)
    if (email) {
      const { rows: emailCheck } = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      if (emailCheck[0]) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered.',
        });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const { rows: [user] } = await client.query(
      `INSERT INTO users (phone, email, password_hash, role, full_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, role, full_name, phone, email, is_verified`,
      [phone, email || null, passwordHash, role, full_name]
    );

    // If hospital — create hospital profile
    if (role === 'hospital') {
      const slug = slugify(hospital_name + '-' + phone.slice(-4), {
        lower: true, strict: true,
      });

      await client.query(
        `INSERT INTO hospitals (user_id, name, slug, kyc_status, tier)
         VALUES ($1, $2, $3, 'pending', 'basic')`,
        [user.id, hospital_name, slug]
      );

      // Start 7-day free trial subscription
      await client.query(
        `INSERT INTO subscriptions
           (hospital_id, plan, status, amount, leads_quota, trial_ends_at)
         SELECT h.id, 'basic', 'trial', 0, 5,
                NOW() + INTERVAL '7 days'
         FROM   hospitals h WHERE h.user_id = $1`,
        [user.id]
      );
    }

    await client.query('COMMIT');

    // Generate tokens
    const tokens = generateTokenPair(user.id, user.role);

    // Save refresh token
    await query(
      'UPDATE users SET refresh_token = $1, last_login_at = NOW() WHERE id = $2',
      [tokens.refreshToken, user.id]
    );

    // Send OTP for phone verification
    const otp = generateOTP();
    await saveOTP(user.id, otp);
    await sendOTPviaSMS(phone, otp);

    return res.status(201).json({
      success: true,
      message: `Account created! OTP sent to ${phone} for verification.`,
      data: {
        user: {
          id:          user.id,
          role:        user.role,
          full_name:   user.full_name,
          phone:       user.phone,
          email:       user.email,
          is_verified: user.is_verified,
        },
        tokens,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Registration failed.' });
  } finally {
    client.release();
  }
};

// ── LOGIN ─────────────────────────────────────────────────────
// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Find user by phone or email
    const { rows } = await query(
      `SELECT id, phone, email, password_hash, role,
              full_name, is_verified, is_active
       FROM users
       WHERE phone = $1 OR email = $1`,
      [identifier]
    );

    if (!rows[0]) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone/email or password.',
      });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account deactivated. Contact support.',
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone/email or password.',
      });
    }

    // Generate tokens
    const tokens = generateTokenPair(user.id, user.role);

    // Save refresh token + update last login
    await query(
      'UPDATE users SET refresh_token = $1, last_login_at = NOW() WHERE id = $2',
      [tokens.refreshToken, user.id]
    );

    // If hospital — fetch hospital info
    let hospitalData = null;
    if (user.role === 'hospital') {
      const { rows: h } = await query(
        `SELECT id, name, slug, kyc_status, tier, is_verified
         FROM hospitals WHERE user_id = $1`,
        [user.id]
      );
      hospitalData = h[0] || null;
    }

    return res.json({
      success: true,
      message: 'Login successful!',
      data: {
        user: {
          id:          user.id,
          role:        user.role,
          full_name:   user.full_name,
          phone:       user.phone,
          email:       user.email,
          is_verified: user.is_verified,
        },
        hospital: hospitalData,
        tokens,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Login failed.' });
  }
};

// ── SEND OTP ──────────────────────────────────────────────────
// POST /api/auth/otp/send
const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    // Find user
    const { rows } = await query(
      'SELECT id, is_verified FROM users WHERE phone = $1',
      [phone]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Phone number not registered.',
      });
    }

    const otp = generateOTP();
    await saveOTP(rows[0].id, otp);
    const result = await sendOTPviaSMS(phone, otp);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Try again.',
      });
    }

    return res.json({
      success: true,
      message: `OTP sent to ${phone}.`,
      // Only in dev mode — never in production!
      ...(result.dev && { dev_otp: otp }),
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP.' });
  }
};

// ── VERIFY OTP ─────────────────────────────────────────────────
// POST /api/auth/otp/verify
const verifyOTPHandler = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // Find user
    const { rows } = await query(
      'SELECT id, role, full_name, email, is_verified FROM users WHERE phone = $1',
      [phone]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Phone number not registered.',
      });
    }

    const user = rows[0];

    // Verify OTP
    const result = await verifyOTP(user.id, otp);
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.reason,
      });
    }

    // Mark phone as verified
    await query(
      'UPDATE users SET is_verified = TRUE WHERE id = $1',
      [user.id]
    );

    // Generate tokens (OTP login = full login)
    const tokens = generateTokenPair(user.id, user.role);
    await query(
      'UPDATE users SET refresh_token = $1, last_login_at = NOW() WHERE id = $2',
      [tokens.refreshToken, user.id]
    );

    return res.json({
      success: true,
      message: 'Phone verified! Login successful.',
      data: {
        user: {
          id:          user.id,
          role:        user.role,
          full_name:   user.full_name,
          phone,
          email:       user.email,
          is_verified: true,
        },
        tokens,
      },
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ success: false, message: 'OTP verification failed.' });
  }
};

// ── REFRESH TOKEN ─────────────────────────────────────────────
// POST /api/auth/refresh
const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refresh_token);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token.',
      });
    }

    // Check it matches what's in DB
    const { rows } = await query(
      'SELECT id, role, refresh_token, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!rows[0] || rows[0].refresh_token !== refresh_token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token mismatch. Please login again.',
      });
    }

    if (!rows[0].is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account deactivated.',
      });
    }

    // Issue new token pair
    const tokens = generateTokenPair(rows[0].id, rows[0].role);
    await query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [tokens.refreshToken, rows[0].id]
    );

    return res.json({
      success: true,
      message: 'Tokens refreshed.',
      data: { tokens },
    });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ success: false, message: 'Token refresh failed.' });
  }
};

// ── LOGOUT ────────────────────────────────────────────────────
// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    await query(
      'UPDATE users SET refresh_token = NULL WHERE id = $1',
      [req.user.id]
    );
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Logout failed.' });
  }
};

// ── GET ME ────────────────────────────────────────────────────
// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, phone, email, full_name, role,
              is_verified, is_active, last_login_at, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let hospitalData = null;
    if (rows[0].role === 'hospital') {
      const { rows: h } = await query(
        `SELECT id, name, slug, kyc_status, tier, is_featured, is_verified
         FROM hospitals WHERE user_id = $1`,
        [req.user.id]
      );
      hospitalData = h[0] || null;
    }

    return res.json({
      success: true,
      data: {
        user:     rows[0],
        hospital: hospitalData,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get profile.' });
  }
};

module.exports = {
  register,
  login,
  sendOTP,
  verifyOTP: verifyOTPHandler,
  refreshToken,
  logout,
  getMe,
};
