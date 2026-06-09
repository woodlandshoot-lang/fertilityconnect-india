// src/utils/leadValidators.js

const Joi = require('joi');

const submitLeadSchema = Joi.object({
  // Public (visible to hospital before unlock)
  age:          Joi.number().integer().min(18).max(60).required(),
  condition:    Joi.string().max(255).required(),
  budget_min:   Joi.number().integer().min(0).required(),
  budget_max:   Joi.number().integer().min(0).required(),
  city:         Joi.string().max(100).required(),
  urgency:      Joi.string()
                  .valid('immediate','within_1_month','1_to_3_months','exploring')
                  .default('exploring'),
  notes_public: Joi.string().max(500).optional().allow(''),

  // Private (encrypted in DB)
  name:          Joi.string().min(2).max(100).required(),
  phone:         Joi.string().pattern(/^\+91[6-9]\d{9}$/).required()
                   .messages({ 'string.pattern.base': 'Valid Indian phone required (+91XXXXXXXXXX)' }),
  email:         Joi.string().email().optional().allow(''),
  notes_private: Joi.string().max(1000).optional().allow(''),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors:  error.details.map((d) => d.message),
    });
  }
  next();
};

module.exports = { submitLeadSchema, validate };
