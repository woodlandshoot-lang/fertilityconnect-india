// src/controllers/adminController.js

const { query, getClient }  = require('../config/db');
const {
  notifyKYCApproved,
  notifyKYCRejected,
  sendEmail,
} = require('../services/notificationService');

// ── DASHBOARD STATS ───────────────────────────────────────────
// GET /api/admin/stats
const getDashboardStats = async (req, res) => {
  try {
    const [users, hospitals, leads, payments, reviews, subs] = await Promise.all([
      query(`SELECT
               COUNT(*)                                           AS total,
               COUNT(*) FILTER (WHERE role = 'client')           AS patients,
               COUNT(*) FILTER (WHERE role = 'hospital')         AS hospitals,
               COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_this_week
             FROM users`),

      query(`SELECT
               COUNT(*)                                             AS total,
               COUNT(*) FILTER (WHERE kyc_status = 'pending')      AS pending_kyc,
               COUNT(*) FILTER (WHERE kyc_status = 'under_review') AS under_review,
               COUNT(*) FILTER (WHERE kyc_status = 'approved')     AS approved,
               COUNT(*) FILTER (WHERE is_featured = TRUE)          AS featured
             FROM hospitals`),

      query(`SELECT
               COUNT(*)                                              AS total,
               COUNT(*) FILTER (WHERE is_active = TRUE)             AS active,
               COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS this_month
             FROM leads`),

      query(`SELECT
               COUNT(*)                                              AS total_payments,
               COALESCE(SUM(amount) FILTER (WHERE status='success'), 0) AS total_revenue_paise,
               COUNT(*) FILTER (WHERE status = 'success' AND created_at > NOW() - INTERVAL '30 days') AS paid_this_month
             FROM payments`),

      query(`SELECT
               COUNT(*)                                            AS total,
               COUNT(*) FILTER (WHERE status = 'pending')         AS pending,
               COUNT(*) FILTER (WHERE status = 'approved')        AS approved
             FROM reviews`),

      query(`SELECT
               COUNT(*)                                            AS total,
               COUNT(*) FILTER (WHERE status = 'active')          AS active,
               COUNT(*) FILTER (WHERE status = 'trial')           AS trial
             FROM subscriptions`),
    ]);

    return res.json({
      success: true,
      data: {
        users:        users.rows[0],
        hospitals:    hospitals.rows[0],
        leads:        leads.rows[0],
        payments: {
          ...payments.rows[0],
          total_revenue_inr: (parseInt(payments.rows[0].total_revenue_paise) / 100).toFixed(2),
        },
        reviews:      reviews.rows[0],
        subscriptions: subs.rows[0],
      },
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
};

// ── KYC QUEUE ─────────────────────────────────────────────────
// GET /api/admin/hospitals/pending
const getKYCQueue = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const validStatuses = ['pending', 'under_review', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status filter.' });
    }

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM hospitals WHERE kyc_status = $1`,
      [status]
    );

    const { rows } = await query(
      `SELECT
         h.id, h.name, h.slug, h.city, h.phone, h.email,
         h.kyc_status, h.kyc_documents, h.kyc_notes,
         h.tier, h.created_at,
         u.full_name AS owner_name, u.phone AS owner_phone,
         u.email AS owner_email
       FROM hospitals h
       JOIN users u ON u.id = h.user_id
       WHERE h.kyc_status = $1
       ORDER BY h.created_at ASC
       LIMIT $2 OFFSET $3`,
      [status, parseInt(limit), offset]
    );

    return res.json({
      success: true,
      data: {
        hospitals: rows,
        pagination: {
          total:      parseInt(countRows[0].count),
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(parseInt(countRows[0].count) / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    console.error('getKYCQueue error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch KYC queue.' });
  }
};

// ── VERIFY HOSPITAL (approve / reject) ────────────────────────
// POST /api/admin/hospitals/:id/verify
// Body: { action: 'approve' | 'reject', notes: '...' }
const verifyHospital = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { id }     = req.params;
    const { action, notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be 'approve' or 'reject'.",
      });
    }

    if (action === 'reject' && !notes) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason (notes) is required.',
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { rows } = await client.query(
      `UPDATE hospitals
       SET kyc_status      = $1,
           kyc_reviewed_at = NOW(),
           kyc_reviewed_by = $2,
           kyc_notes       = $3,
           is_verified     = $4,
           is_active       = $5,
           updated_at      = NOW()
       WHERE id = $6
       RETURNING id, name, user_id, kyc_status`,
      [
        newStatus,
        req.user.id,
        notes || null,
        action === 'approve',
        action === 'approve',
        id,
      ]
    );

    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }

    const hospital = rows[0];

    // Get user phone for notification
    const { rows: userRows } = await client.query(
      'SELECT phone FROM users WHERE id = $1',
      [hospital.user_id]
    );

    await client.query('COMMIT');

    // Send notifications
    if (action === 'approve') {
      await notifyKYCApproved(hospital.user_id, userRows[0]?.phone);
    } else {
      await notifyKYCRejected(hospital.user_id, userRows[0]?.phone, notes);
    }

    return res.json({
      success: true,
      message: `Hospital ${action === 'approve' ? '✅ approved' : '❌ rejected'} successfully.`,
      data: { hospital },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('verifyHospital error:', err);
    return res.status(500).json({ success: false, message: 'KYC action failed.' });
  } finally {
    client.release();
  }
};

// ── REVIEW MODERATION QUEUE ───────────────────────────────────
// GET /api/admin/reviews/pending
const getReviewQueue = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows: countRows } = await query(
      'SELECT COUNT(*) FROM reviews WHERE status = $1',
      [status]
    );

    const { rows } = await query(
      `SELECT
         r.id, r.rating, r.title, r.text, r.video_url,
         r.is_anonymous, r.display_name, r.treatment,
         r.status, r.created_at,
         h.name AS hospital_name, h.id AS hospital_id,
         u.full_name AS reviewer_name, u.phone AS reviewer_phone
       FROM reviews r
       JOIN hospitals h ON h.id = r.hospital_id
       LEFT JOIN users u ON u.id = r.client_id
       WHERE r.status = $1
       ORDER BY r.created_at ASC
       LIMIT $2 OFFSET $3`,
      [status, parseInt(limit), offset]
    );

    return res.json({
      success: true,
      data: {
        reviews: rows,
        pagination: {
          total:      parseInt(countRows[0].count),
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(parseInt(countRows[0].count) / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    console.error('getReviewQueue error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch reviews.' });
  }
};

// ── MODERATE REVIEW (approve / reject) ───────────────────────
// POST /api/admin/reviews/:id/moderate
// Body: { action: 'approve' | 'reject', reason: '...' }
const moderateReview = async (req, res) => {
  try {
    const { id }              = req.params;
    const { action, reason }  = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be 'approve' or 'reject'.",
      });
    }

    const { rows } = await query(
      `UPDATE reviews
       SET status        = $1,
           moderated_by  = $2,
           moderated_at  = NOW(),
           reject_reason = $3,
           updated_at    = NOW()
       WHERE id = $4
       RETURNING id, status, hospital_id`,
      [
        action === 'approve' ? 'approved' : 'rejected',
        req.user.id,
        reason || null,
        id,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    // Update hospital avg rating cache (recalculate)
    await query(
      `UPDATE hospitals SET updated_at = NOW() WHERE id = $1`,
      [rows[0].hospital_id]
    );

    return res.json({
      success: true,
      message: `Review ${action === 'approve' ? '✅ approved' : '❌ rejected'}.`,
      data:    { review: rows[0] },
    });
  } catch (err) {
    console.error('moderateReview error:', err);
    return res.status(500).json({ success: false, message: 'Moderation failed.' });
  }
};

// ── MANAGE SUBSCRIPTIONS ──────────────────────────────────────
// GET /api/admin/subscriptions
const getAllSubscriptions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    const params     = [];

    if (status) {
      params.push(status);
      conditions.push(`s.status = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM subscriptions s ${where}`,
      params
    );

    params.push(parseInt(limit));
    params.push(offset);

    const { rows } = await query(
      `SELECT
         s.id, s.plan, s.status, s.amount,
         s.leads_quota, s.leads_used,
         s.trial_ends_at, s.starts_at, s.ends_at,
         s.created_at,
         h.name AS hospital_name, h.city,
         u.full_name AS owner_name, u.phone AS owner_phone
       FROM subscriptions s
       JOIN hospitals h ON h.id = s.hospital_id
       JOIN users u ON u.id = h.user_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const subs = rows.map((s) => ({
      ...s,
      amount_inr:       (s.amount / 100).toFixed(2),
      leads_remaining:  s.leads_quota - s.leads_used,
    }));

    return res.json({
      success: true,
      data: {
        subscriptions: subs,
        pagination: {
          total:      parseInt(countRows[0].count),
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(parseInt(countRows[0].count) / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    console.error('getAllSubscriptions error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch subscriptions.' });
  }
};

// ── TOGGLE FEATURED ───────────────────────────────────────────
// POST /api/admin/hospitals/:id/feature
// Body: { featured: true | false }
const toggleFeatured = async (req, res) => {
  try {
    const { id }       = req.params;
    const { featured } = req.body;

    if (typeof featured !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'featured must be true or false.',
      });
    }

    const { rows } = await query(
      `UPDATE hospitals
       SET is_featured = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, is_featured`,
      [featured, id]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }

    return res.json({
      success: true,
      message: `Hospital ${featured ? '⭐ marked as featured' : 'removed from featured'}.`,
      data:    { hospital: rows[0] },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to toggle featured.' });
  }
};

// ── APPROVE SUCCESS RATE ──────────────────────────────────────
// POST /api/admin/hospitals/:id/verify-rate
// Body: { ivf_success_rate: 72.5 }
const verifySuccessRate = async (req, res) => {
  try {
    const { id }              = req.params;
    const { ivf_success_rate } = req.body;

    if (!ivf_success_rate || ivf_success_rate < 0 || ivf_success_rate > 100) {
      return res.status(400).json({
        success: false,
        message: 'ivf_success_rate must be between 0 and 100.',
      });
    }

    const { rows } = await query(
      `UPDATE hospitals
       SET ivf_success_rate      = $1,
           success_rate_verified = TRUE,
           updated_at            = NOW()
       WHERE id = $2
       RETURNING id, name, ivf_success_rate, success_rate_verified`,
      [parseFloat(ivf_success_rate), id]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }

    return res.json({
      success: true,
      message: `✅ Success rate ${ivf_success_rate}% verified for ${rows[0].name}.`,
      data:    { hospital: rows[0] },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to verify rate.' });
  }
};

// ── ALL USERS ─────────────────────────────────────────────────
// GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conds  = [];

    if (role) {
      params.push(role);
      conds.push(`role = $${params.length}`);
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const { rows: cnt } = await query(
      `SELECT COUNT(*) FROM users ${where}`, params
    );

    params.push(parseInt(limit));
    params.push(offset);

    const { rows } = await query(
      `SELECT id, phone, email, full_name, role,
              is_verified, is_active, last_login_at, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      success: true,
      data: {
        users: rows,
        pagination: {
          total:      parseInt(cnt[0].count),
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(parseInt(cnt[0].count) / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

// ── DEACTIVATE USER ───────────────────────────────────────────
// PATCH /api/admin/users/:id/deactivate
const deactivateUser = async (req, res) => {
  try {
    const { id }    = req.params;
    const { active } = req.body; // true to reactivate, false to deactivate

    // Prevent deactivating yourself
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account.',
      });
    }

    const { rows } = await query(
      `UPDATE users SET is_active = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, full_name, is_active`,
      [active !== false, id]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      message: `User ${rows[0].is_active ? 'reactivated ✅' : 'deactivated ❌'}.`,
      data:    { user: rows[0] },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Action failed.' });
  }
};

// ── PLATFORM ANALYTICS ────────────────────────────────────────
// GET /api/admin/analytics
const getPlatformAnalytics = async (req, res) => {
  try {
    // Revenue by month (last 6 months)
    const { rows: revenue } = await query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', paid_at), 'Mon YYYY') AS month,
         SUM(amount)                                        AS total_paise,
         COUNT(*)                                           AS transactions
       FROM payments
       WHERE status = 'success'
         AND paid_at > NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', paid_at)
       ORDER BY DATE_TRUNC('month', paid_at) ASC`
    );

    // Top cities by leads
    const { rows: topCities } = await query(
      `SELECT city, COUNT(*) AS lead_count
       FROM leads WHERE is_active = TRUE
       GROUP BY city
       ORDER BY lead_count DESC
       LIMIT 10`
    );

    // Top hospitals by leads unlocked
    const { rows: topHospitals } = await query(
      `SELECT h.name, h.city, COUNT(lu.id) AS unlocks
       FROM lead_unlocks lu
       JOIN hospitals h ON h.id = lu.hospital_id
       GROUP BY h.id
       ORDER BY unlocks DESC
       LIMIT 10`
    );

    // Condition breakdown
    const { rows: conditions } = await query(
      `SELECT condition, COUNT(*) AS count
       FROM leads
       GROUP BY condition
       ORDER BY count DESC
       LIMIT 10`
    );

    return res.json({
      success: true,
      data: {
        revenue: revenue.map((r) => ({
          ...r,
          total_inr: (parseInt(r.total_paise) / 100).toFixed(2),
        })),
        top_cities:    topCities,
        top_hospitals: topHospitals,
        conditions,
      },
    });
  } catch (err) {
    console.error('getPlatformAnalytics error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch analytics.' });
  }
};

module.exports = {
  getDashboardStats,
  getKYCQueue,
  verifyHospital,
  getReviewQueue,
  moderateReview,
  getAllSubscriptions,
  toggleFeatured,
  verifySuccessRate,
  getAllUsers,
  deactivateUser,
  getPlatformAnalytics,
};
