// src/middleware/auth.js
// Verifies JWT token on protected routes

const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const env = require('../config/env');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, env.jwt.secret);

    // Check user still exists and is active
    const { rows } = await query(
      'SELECT id, role, is_active, is_verified FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!rows[0]) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (!rows[0].is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Contact support.',
      });
    }

    // Attach user to request
    req.user = {
      id:         decoded.userId,
      role:       rows[0].role,
      isVerified: rows[0].is_verified,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
};

module.exports = auth;
