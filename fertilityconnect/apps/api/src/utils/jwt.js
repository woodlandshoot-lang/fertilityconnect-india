// src/utils/jwt.js

const jwt  = require('jsonwebtoken');
const env  = require('../config/env');

// Generate access token (short-lived: 15 min)
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
};

// Generate refresh token (long-lived: 30 days)
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn }
  );
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.jwt.refreshSecret);
};

// Generate both tokens at once
const generateTokenPair = (userId, role) => ({
  accessToken:  generateAccessToken(userId, role),
  refreshToken: generateRefreshToken(userId),
});

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateTokenPair,
};
