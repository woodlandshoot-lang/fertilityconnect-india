// src/utils/validators.js

const Joi = require('joi');

// ── Auth ──────────────────────────────────────────────────────

const registerSchema = Joi.object({
  role:      Joi.string().valid('client', 'hospital').required(),
  full_name: Joi.string().min(2).max(100).required(),
  phone:     Joi.string().pattern(/^\+91[6-9]\d{9}$/).required()
             .messages({ 'string.pattern.base': 'Phone must be valid Indian number (+91XXXXXXXXXX)' }),
  email:     Joi.string().email().optional(),
  password:  Joi.string().min(8).max(64)
             .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
             .required()
             .messages({ 'string.pattern.base': 'Password must have uppercase, lowercase and number' }),
  // Hospital only
  hospital_name: Joi.when('role', {
    is: 'hospital',
    then: Joi.string().min(3).max(255).required(),
    otherwise: Joi.forbidden(),
  }),
});

const loginSchema = Joi.object({
  identifier: Joi.string().required(), // phone or email
  password:   Joi.string().required(),
});

const otpSendSchema = Joi.object({
  phone: Joi.string().pattern(/^\+91[6-9]\d{9}$/).required(),
});

const otpVerifySchema = Joi.object({
  phone: Joi.string().pattern(/^\+91[6-9]\d{9}$/).required(),
  otp:   Joi.string().length(6).pattern(/^\d+$/).required(),
});

const refreshSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).max(64)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required(),
});

// ── Middleware helper ─────────────────────────────────────────
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map((d) => d.message),
    });
  }
  next();
};

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  otpSendSchema,
  otpVerifySchema,
  refreshSchema,
  changePasswordSchema,
};
