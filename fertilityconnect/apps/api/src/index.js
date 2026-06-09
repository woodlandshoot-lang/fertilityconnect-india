// Load env first
const env = require('./config/env');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes       = require('./routes/auth');
const hospitalRoutes   = require('./routes/hospitals');
const leadRoutes       = require('./routes/leads');
const paymentRoutes    = require('./routes/payments');
const reviewRoutes     = require('./routes/reviews');
const adminRoutes      = require('./routes/admin');
const userRoutes       = require('./routes/user');
const mediaRoutes      = require('./routes/media');
const seoRoutes        = require('./routes/seo');

const app = express();

// ── Security Middleware ──────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: env.frontend.url,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

// Razorpay webhook needs raw body - so parse before json middleware
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ────────────────────────────────────────────
// Global: 100 requests per 15 minutes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth routes: stricter - 10 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many auth attempts. Please wait.' },
});

app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);

// ── Health Check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'FertilityConnect API is running 🌸',
    version: '1.0.0',
    env: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/leads',     leadRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/reviews',   reviewRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/user',      userRoutes);
app.use('/api/media',     mediaRoutes);
app.use('/api/seo',       seoRoutes);
app.use('/',              seoRoutes);   // for /sitemap.xml and /robots.txt

// ── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
  });
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('🔴 Unhandled error:', err);

  // Joi validation error
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.details.map((d) => d.message),
    });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Record already exists',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: env.isProd ? 'Internal server error' : err.message,
  });
});

// ── Start Server ─────────────────────────────────────────────
app.listen(env.port, () => {
  console.log('');
  console.log('🌸 ─────────────────────────────────────────');
  console.log(`🚀  FertilityConnect API started`);
  console.log(`📡  Port     : ${env.port}`);
  console.log(`🌍  Env      : ${env.nodeEnv}`);
  console.log(`🔗  Health   : http://localhost:${env.port}/health`);
  console.log('🌸 ─────────────────────────────────────────');
  console.log('');

  // Start background cron jobs
  const { startScheduler } = require('./services/cronScheduler');
  startScheduler();
});

module.exports = app;
