// src/services/cronScheduler.js
// Runs scheduled background jobs
// Called once from src/index.js on server start

const { checkExpiringSubscriptions } = require('./notificationService');
const { query } = require('../config/db');

// Simple interval-based scheduler (no extra packages needed)
// For production, use node-cron or a proper job queue

const MS = {
  MINUTE:  60 * 1000,
  HOUR:    60 * 60 * 1000,
  DAY:     24 * 60 * 60 * 1000,
};

// ── JOB 1: Check expiring subscriptions (daily) ───────────────
const jobExpiringSubscriptions = async () => {
  try {
    console.log('⏰ [CRON] Running: checkExpiringSubscriptions');
    await checkExpiringSubscriptions();
  } catch (err) {
    console.error('[CRON] checkExpiringSubscriptions failed:', err.message);
  }
};

// ── JOB 2: Reset monthly lead quota (daily check) ────────────
const jobResetLeadQuota = async () => {
  try {
    const { rowCount } = await query(
      `UPDATE subscriptions
       SET leads_used     = 0,
           quota_reset_at = NOW() + INTERVAL '30 days',
           updated_at     = NOW()
       WHERE status IN ('active', 'trial')
         AND quota_reset_at < NOW()`
    );
    if (rowCount > 0) {
      console.log(`⏰ [CRON] Lead quota reset for ${rowCount} subscription(s)`);
    }
  } catch (err) {
    console.error('[CRON] jobResetLeadQuota failed:', err.message);
  }
};

// ── JOB 3: Expire old leads (daily) ──────────────────────────
const jobExpireOldLeads = async () => {
  try {
    const { rowCount } = await query(
      `UPDATE leads
       SET is_active = FALSE, updated_at = NOW()
       WHERE is_active = TRUE AND expires_at < NOW()`
    );
    if (rowCount > 0) {
      console.log(`⏰ [CRON] Expired ${rowCount} old lead(s)`);
    }
  } catch (err) {
    console.error('[CRON] jobExpireOldLeads failed:', err.message);
  }
};

// ── JOB 4: Expire subscriptions ───────────────────────────────
const jobExpireSubscriptions = async () => {
  try {
    const { rowCount } = await query(
      `UPDATE subscriptions
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'active' AND ends_at < NOW()`
    );
    if (rowCount > 0) {
      // Downgrade hospital tier
      await query(
        `UPDATE hospitals h SET tier = 'basic', updated_at = NOW()
         FROM subscriptions s
         WHERE s.hospital_id = h.id
           AND s.status = 'expired'
           AND s.updated_at > NOW() - INTERVAL '1 hour'`
      );
      console.log(`⏰ [CRON] Expired ${rowCount} subscription(s), downgraded to Basic`);
    }
  } catch (err) {
    console.error('[CRON] jobExpireSubscriptions failed:', err.message);
  }
};

// ── START ALL JOBS ────────────────────────────────────────────
const startScheduler = () => {
  console.log('⏰ Cron scheduler started');

  // Run immediately on startup
  setTimeout(async () => {
    await jobExpireOldLeads();
    await jobExpireSubscriptions();
    await jobResetLeadQuota();
    await jobExpiringSubscriptions();
  }, 5000); // 5s after server ready

  // Daily jobs — every 24 hours
  setInterval(jobExpiringSubscriptions, MS.DAY);
  setInterval(jobResetLeadQuota,        MS.DAY);
  setInterval(jobExpireOldLeads,        MS.DAY);
  setInterval(jobExpireSubscriptions,   MS.HOUR); // check every hour
};

module.exports = { startScheduler };
