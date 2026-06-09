// src/utils/otp.js

const crypto  = require('crypto');
const { query } = require('../config/db');
const env     = require('../config/env');

// Generate 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Save OTP to DB with expiry
const saveOTP = async (userId, otp) => {
  const expiresAt = new Date(
    Date.now() + env.otp.expiresMinutes * 60 * 1000
  );
  await query(
    'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3',
    [otp, expiresAt, userId]
  );
};

// Verify OTP from DB
const verifyOTP = async (userId, otp) => {
  const { rows } = await query(
    `SELECT otp_code, otp_expires_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (!rows[0]) return { valid: false, reason: 'User not found' };

  const { otp_code, otp_expires_at } = rows[0];

  if (!otp_code) return { valid: false, reason: 'No OTP requested' };

  if (new Date() > new Date(otp_expires_at)) {
    return { valid: false, reason: 'OTP expired' };
  }

  if (otp_code !== otp) {
    return { valid: false, reason: 'Invalid OTP' };
  }

  // Clear OTP after successful verify
  await query(
    'UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = $1',
    [userId]
  );

  return { valid: true };
};

// Send OTP via Twilio SMS
const sendOTPviaSMS = async (phone, otp) => {
  // Skip in dev/test
  if (env.nodeEnv === 'development') {
    console.log(`📱 [DEV] OTP for ${phone}: ${otp}`);
    return { success: true, dev: true };
  }

  try {
    const twilio = require('twilio')(
      env.twilio.accountSid,
      env.twilio.authToken
    );

    await twilio.messages.create({
      body: `Your FertilityConnect OTP is: ${otp}. Valid for ${env.otp.expiresMinutes} minutes. Do not share with anyone.`,
      from: env.twilio.phone,
      to:   phone,
    });

    return { success: true };
  } catch (err) {
    console.error('SMS send failed:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { generateOTP, saveOTP, verifyOTP, sendOTPviaSMS };

// ── OTP Brute Force Protection ────────────────────────────────
const MAX_ATTEMPTS = 5;
const BLOCK_MINUTES = 30;

const checkOTPRateLimit = async (phone) => {
  try {
    const { rows } = await query(
      'SELECT attempts, blocked_until FROM otp_attempts WHERE phone=$1',
      [phone]
    );
    if (!rows[0]) return { allowed: true };

    // Check if currently blocked
    if (rows[0].blocked_until && new Date() < new Date(rows[0].blocked_until)) {
      const minutesLeft = Math.ceil(
        (new Date(rows[0].blocked_until) - new Date()) / 60000
      );
      return { allowed: false, minutesLeft };
    }

    if (rows[0].attempts >= MAX_ATTEMPTS) {
      // Block for 30 minutes
      await query(
        `UPDATE otp_attempts
         SET blocked_until = NOW() + INTERVAL '${BLOCK_MINUTES} minutes',
             last_attempt  = NOW()
         WHERE phone=$1`,
        [phone]
      );
      return { allowed: false, minutesLeft: BLOCK_MINUTES };
    }

    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open
  }
};

const incrementOTPAttempt = async (phone) => {
  try {
    await query(
      `INSERT INTO otp_attempts (phone, attempts, last_attempt)
       VALUES ($1, 1, NOW())
       ON CONFLICT (phone) DO UPDATE
       SET attempts     = otp_attempts.attempts + 1,
           last_attempt = NOW()`,
      [phone]
    );
  } catch { /* ignore */ }
};

const resetOTPAttempts = async (phone) => {
  try {
    await query(
      'DELETE FROM otp_attempts WHERE phone=$1',
      [phone]
    );
  } catch { /* ignore */ }
};

module.exports = {
  ...module.exports,
  checkOTPRateLimit,
  incrementOTPAttempt,
  resetOTPAttempts,
};
