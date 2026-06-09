// src/middleware/kycGuard.js
// Blocks hospital actions until KYC is approved

const { query } = require('../config/db');

const kycGuard = async (req, res, next) => {
  try {
    if (req.user.role !== 'hospital') return next();

    const { rows } = await query(
      `SELECT h.kyc_status, h.id as hospital_id
       FROM hospitals h
       WHERE h.user_id = $1`,
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(403).json({
        success: false,
        message: 'Hospital profile not found. Please complete registration.',
        code: 'NO_HOSPITAL_PROFILE',
      });
    }

    if (rows[0].kyc_status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'KYC verification pending. You cannot access leads until approved.',
        code: 'KYC_PENDING',
        kyc_status: rows[0].kyc_status,
      });
    }

    // Attach hospital_id to request
    req.hospitalId = rows[0].hospital_id;
    next();

  } catch (err) {
    next(err);
  }
};

module.exports = kycGuard;
