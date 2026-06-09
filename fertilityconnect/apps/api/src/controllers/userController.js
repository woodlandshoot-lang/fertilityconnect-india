// src/controllers/userController.js
// Patient profile, password reset, saved hospitals

const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const { query, getClient } = require('../config/db');
const { generateOTP, saveOTP, verifyOTP, sendOTPviaSMS } = require('../utils/otp');
const { sendEmail } = require('../services/notificationService');
const { otpEmail } = require('../services/emailTemplates');

// ── GET PATIENT PROFILE ───────────────────────────────────────
// GET /api/user/profile
const getProfile = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, phone, email, full_name, role,
              is_verified, last_login_at, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success:false, message:'User not found.' });
    return res.json({ success:true, data:{ user: rows[0] } });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Failed to get profile.' });
  }
};

// ── UPDATE PATIENT PROFILE ────────────────────────────────────
// PUT /api/user/profile
const updateProfile = async (req, res) => {
  try {
    const { full_name, email } = req.body;

    // Check email not taken by someone else
    if (email) {
      const { rows: chk } = await query(
        'SELECT id FROM users WHERE email=$1 AND id!=$2', [email, req.user.id]
      );
      if (chk[0]) return res.status(409).json({ success:false, message:'Email already in use.' });
    }

    const { rows } = await query(
      `UPDATE users
       SET full_name  = COALESCE($1, full_name),
           email      = COALESCE($2, email),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, full_name, email, phone`,
      [full_name||null, email||null, req.user.id]
    );

    return res.json({ success:true, message:'Profile updated!', data:{ user: rows[0] } });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Update failed.' });
  }
};

// ── CHANGE PASSWORD ───────────────────────────────────────────
// PUT /api/user/change-password
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ success:false, message:'Both passwords required.' });
    if (new_password.length < 8)
      return res.status(400).json({ success:false, message:'New password min 8 characters.' });

    const { rows } = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ success:false, message:'User not found.' });

    const match = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!match) return res.status(401).json({ success:false, message:'Current password is incorrect.' });

    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id]);

    return res.json({ success:true, message:'Password changed successfully.' });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Password change failed.' });
  }
};

// ── FORGOT PASSWORD — Send OTP ────────────────────────────────
// POST /api/user/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success:false, message:'Phone required.' });

    const { rows } = await query(
      'SELECT id, full_name, email FROM users WHERE phone=$1', [phone]
    );
    // Always return success (security — don't reveal if phone exists)
    if (!rows[0]) {
      return res.json({ success:true, message:`OTP sent to ${phone} if registered.` });
    }

    const otp = generateOTP();
    await saveOTP(rows[0].id, otp);
    await sendOTPviaSMS(phone, otp);

    // Also send email if available
    if (rows[0].email) {
      await sendEmail(
        rows[0].email,
        'FertilityConnect — Password Reset OTP',
        otpEmail({ name: rows[0].full_name || 'User', otp })
      );
    }

    return res.json({
      success: true,
      message: `OTP sent to ${phone}.`,
      user_id: rows[0].id,     // needed for reset step
    });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Failed to send OTP.' });
  }
};

// ── RESET PASSWORD — Verify OTP + set new password ───────────
// POST /api/user/reset-password
const resetPassword = async (req, res) => {
  try {
    const { phone, otp, new_password } = req.body;
    if (!phone || !otp || !new_password)
      return res.status(400).json({ success:false, message:'phone, otp and new_password required.' });
    if (new_password.length < 8)
      return res.status(400).json({ success:false, message:'Password min 8 characters.' });

    const { rows } = await query('SELECT id FROM users WHERE phone=$1', [phone]);
    if (!rows[0]) return res.status(404).json({ success:false, message:'User not found.' });

    const result = await verifyOTP(rows[0].id, otp);
    if (!result.valid)
      return res.status(400).json({ success:false, message: result.reason });

    const hash = await bcrypt.hash(new_password, 12);
    await query(
      'UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2',
      [hash, rows[0].id]
    );

    return res.json({ success:true, message:'Password reset successfully! Please login.' });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Password reset failed.' });
  }
};

// ── SAVED HOSPITALS ───────────────────────────────────────────
// Migration needed: saved_hospitals table
// For now using a JSONB column approach via user metadata

// POST /api/user/saved/:hospitalId
const saveHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    // Check hospital exists
    const { rows: h } = await query(
      'SELECT id FROM hospitals WHERE id=$1 AND is_active=TRUE', [hospitalId]
    );
    if (!h[0]) return res.status(404).json({ success:false, message:'Hospital not found.' });

    // Upsert into saved_hospitals
    await query(
      `INSERT INTO saved_hospitals (user_id, hospital_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.user.id, hospitalId]
    );

    return res.json({ success:true, message:'Hospital saved! ❤️' });
  } catch(err) {
    // Table might not exist yet — handle gracefully
    if (err.code === '42P01') {
      return res.status(500).json({ success:false, message:'Saved hospitals feature not set up yet.' });
    }
    return res.status(500).json({ success:false, message:'Failed to save.' });
  }
};

// DELETE /api/user/saved/:hospitalId
const unsaveHospital = async (req, res) => {
  try {
    await query(
      'DELETE FROM saved_hospitals WHERE user_id=$1 AND hospital_id=$2',
      [req.user.id, req.params.hospitalId]
    );
    return res.json({ success:true, message:'Removed from saved.' });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Failed.' });
  }
};

// GET /api/user/saved
const getSavedHospitals = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT h.id, h.name, h.slug, h.city, h.area,
              h.ivf_success_rate, h.tier, h.logo_url,
              COALESCE(AVG(r.rating),0)::DECIMAL(3,1) AS avg_rating,
              s.saved_at
       FROM saved_hospitals s
       JOIN hospitals h ON h.id = s.hospital_id
       LEFT JOIN reviews r ON r.hospital_id = h.id AND r.status='approved'
       WHERE s.user_id = $1
       GROUP BY h.id, s.saved_at
       ORDER BY s.saved_at DESC`,
      [req.user.id]
    );
    return res.json({ success:true, data:{ saved: rows } });
  } catch(err) {
    if (err.code === '42P01') {
      return res.json({ success:true, data:{ saved: [] } });
    }
    return res.status(500).json({ success:false, message:'Failed to fetch saved.' });
  }
};

// ── DELETE ACCOUNT ────────────────────────────────────────────
// DELETE /api/user/account
const deleteAccount = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { password } = req.body;

    const { rows } = await client.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ success:false, message:'User not found.' });

    const match = await bcrypt.compare(password, rows[0].password_hash);
    if (!match) return res.status(401).json({ success:false, message:'Incorrect password.' });

    // Anonymise leads instead of deleting (preserve hospital data)
    await client.query(
      `UPDATE leads SET client_id=NULL,
         name_encrypted=NULL, phone_encrypted=NULL, email_encrypted=NULL
       WHERE client_id=$1`,
      [req.user.id]
    );

    // Deactivate account
    await client.query(
      'UPDATE users SET is_active=FALSE, phone=NULL, email=NULL, updated_at=NOW() WHERE id=$1',
      [req.user.id]
    );

    await client.query('COMMIT');
    return res.json({ success:true, message:'Account deleted. Sorry to see you go.' });
  } catch(err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success:false, message:'Account deletion failed.' });
  } finally {
    client.release();
  }
};

module.exports = {
  getProfile, updateProfile, changePassword,
  forgotPassword, resetPassword,
  saveHospital, unsaveHospital, getSavedHospitals,
  deleteAccount,
};
