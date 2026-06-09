// src/controllers/hospitalController.js

const slugify  = require('slugify');
const { query, getClient } = require('../config/db');

// ── LIST HOSPITALS (Public) ───────────────────────────────────
// GET /api/hospitals?city=Mumbai&tier=premium&min_rate=60&max_price=200000&page=1
const listHospitals = async (req, res) => {
  try {
    const {
      city, tier, min_rate, max_price, min_price,
      search, featured, page = 1, limit = 10,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [
      'h.is_active = TRUE',
      "h.kyc_status = 'approved'",
    ];

    if (city) {
      params.push(city);
      conditions.push(`LOWER(h.city) = LOWER($${params.length})`);
    }
    if (tier) {
      params.push(tier);
      conditions.push(`h.tier = $${params.length}`);
    }
    if (min_rate) {
      params.push(parseFloat(min_rate));
      conditions.push(`h.ivf_success_rate >= $${params.length}`);
    }
    if (featured === 'true') {
      conditions.push('h.is_featured = TRUE');
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(
        `(LOWER(h.name) LIKE $${params.length} OR LOWER(h.city) LIKE $${params.length} OR LOWER(h.area) LIKE $${params.length})`
      );
    }

    const where = conditions.join(' AND ');

    // Count total
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM hospitals h WHERE ${where}`,
      params
    );
    const total = parseInt(countRows[0].count);

    // Fetch hospitals
    params.push(parseInt(limit));
    params.push(offset);

    const { rows } = await query(
      `SELECT
         h.id, h.name, h.slug, h.city, h.area, h.state,
         h.ivf_success_rate, h.tier, h.is_featured, h.is_verified,
         h.facilities, h.treatments, h.doctors,
         h.logo_url, h.cover_image_url,
         h.phone, h.email, h.description,
         h.founded_year,
         COALESCE(AVG(r.rating), 0)::DECIMAL(3,1) AS avg_rating,
         COUNT(DISTINCT r.id)                      AS review_count,
         COUNT(DISTINCT lu.id)                     AS total_leads
       FROM hospitals h
       LEFT JOIN reviews r
         ON r.hospital_id = h.id AND r.status = 'approved'
       LEFT JOIN lead_unlocks lu ON lu.hospital_id = h.id
       WHERE ${where}
       GROUP BY h.id
       ORDER BY h.is_featured DESC, avg_rating DESC, h.ivf_success_rate DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      success: true,
      data: {
        hospitals: rows,
        pagination: {
          total,
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    console.error('listHospitals error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch hospitals.' });
  }
};

// ── GET SINGLE HOSPITAL (Public, SEO page) ────────────────────
// GET /api/hospitals/:slug
const getHospital = async (req, res) => {
  try {
    const { slug } = req.params;

    const { rows } = await query(
      `SELECT
         h.*,
         COALESCE(AVG(r.rating), 0)::DECIMAL(3,1) AS avg_rating,
         COUNT(DISTINCT r.id)                      AS review_count
       FROM hospitals h
       LEFT JOIN reviews r
         ON r.hospital_id = h.id AND r.status = 'approved'
       WHERE h.slug = $1 AND h.is_active = TRUE
       GROUP BY h.id`,
      [slug]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found.',
      });
    }

    // Fetch approved reviews
    const { rows: reviews } = await query(
      `SELECT id, rating, title, text, video_url,
              display_name, is_anonymous, treatment,
              outcome, helpful_count, created_at
       FROM reviews
       WHERE hospital_id = $1 AND status = 'approved'
       ORDER BY created_at DESC
       LIMIT 10`,
      [rows[0].id]
    );

    return res.json({
      success: true,
      data: { hospital: rows[0], reviews },
    });
  } catch (err) {
    console.error('getHospital error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch hospital.' });
  }
};

// ── CITY LANDING PAGE (Public, SEO) ──────────────────────────
// GET /api/hospitals/city/:city
const getByCity = async (req, res) => {
  try {
    const { city } = req.params;

    const { rows } = await query(
      `SELECT
         h.id, h.name, h.slug, h.city, h.area,
         h.ivf_success_rate, h.tier, h.is_featured,
         h.logo_url, h.description, h.treatments,
         COALESCE(AVG(r.rating), 0)::DECIMAL(3,1) AS avg_rating,
         COUNT(DISTINCT r.id)                      AS review_count
       FROM hospitals h
       LEFT JOIN reviews r
         ON r.hospital_id = h.id AND r.status = 'approved'
       WHERE LOWER(h.city) = LOWER($1)
         AND h.is_active = TRUE
         AND h.kyc_status = 'approved'
       GROUP BY h.id
       ORDER BY h.is_featured DESC, avg_rating DESC
       LIMIT 20`,
      [city]
    );

    return res.json({
      success: true,
      data: {
        city,
        count:     rows.length,
        hospitals: rows,
        // SEO meta
        seo: {
          title:       `Best IVF Clinics in ${city} | FertilityConnect India`,
          description: `Find top ${rows.length}+ verified IVF hospitals in ${city}. Compare success rates, read reviews, consult anonymously.`,
        },
      },
    });
  } catch (err) {
    console.error('getByCity error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch city data.' });
  }
};

// ── SEARCH (Public) ───────────────────────────────────────────
// GET /api/hospitals/search?q=low+amh+mumbai
const searchHospitals = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters.',
      });
    }

    const term = `%${q.toLowerCase()}%`;

    const { rows } = await query(
      `SELECT
         h.id, h.name, h.slug, h.city, h.area,
         h.ivf_success_rate, h.tier, h.logo_url,
         COALESCE(AVG(r.rating), 0)::DECIMAL(3,1) AS avg_rating
       FROM hospitals h
       LEFT JOIN reviews r
         ON r.hospital_id = h.id AND r.status = 'approved'
       WHERE h.is_active = TRUE
         AND h.kyc_status = 'approved'
         AND (
           LOWER(h.name)        LIKE $1 OR
           LOWER(h.city)        LIKE $1 OR
           LOWER(h.area)        LIKE $1 OR
           LOWER(h.description) LIKE $1 OR
           h.treatments::text   LIKE $1
         )
       GROUP BY h.id
       ORDER BY h.is_featured DESC, avg_rating DESC
       LIMIT 15`,
      [term]
    );

    return res.json({
      success: true,
      data: { query: q, count: rows.length, hospitals: rows },
    });
  } catch (err) {
    console.error('searchHospitals error:', err);
    return res.status(500).json({ success: false, message: 'Search failed.' });
  }
};

// ── GET MY PROFILE (Hospital dashboard) ──────────────────────
// GET /api/hospital/profile   (protected, hospital role)
const getMyProfile = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT h.*,
         s.plan, s.status AS sub_status,
         s.leads_quota, s.leads_used,
         s.trial_ends_at, s.ends_at AS sub_ends_at
       FROM hospitals h
       LEFT JOIN subscriptions s ON s.hospital_id = h.id
       WHERE h.user_id = $1`,
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Hospital profile not found.',
      });
    }

    return res.json({ success: true, data: { hospital: rows[0] } });
  } catch (err) {
    console.error('getMyProfile error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get profile.' });
  }
};

// ── UPDATE MY PROFILE (Hospital dashboard) ────────────────────
// PUT /api/hospital/profile
const updateMyProfile = async (req, res) => {
  try {
    const {
      name, description, city, state, area, address, pincode,
      phone, email, website, founded_year,
      ivf_success_rate, facilities, treatments, doctors,
      certifications, meta_title, meta_description,
    } = req.body;

    // Get hospital id
    const { rows: hRows } = await query(
      'SELECT id, name FROM hospitals WHERE user_id = $1',
      [req.user.id]
    );
    if (!hRows[0]) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    // Rebuild slug if name changed
    let slug;
    if (name && name !== hRows[0].name) {
      const base = slugify(name + '-' + city, { lower: true, strict: true });
      slug = base;
    }

    const { rows: updated } = await query(
      `UPDATE hospitals SET
         name              = COALESCE($1,  name),
         slug              = COALESCE($2,  slug),
         description       = COALESCE($3,  description),
         city              = COALESCE($4,  city),
         state             = COALESCE($5,  state),
         area              = COALESCE($6,  area),
         address           = COALESCE($7,  address),
         pincode           = COALESCE($8,  pincode),
         phone             = COALESCE($9,  phone),
         email             = COALESCE($10, email),
         website           = COALESCE($11, website),
         founded_year      = COALESCE($12, founded_year),
         ivf_success_rate  = COALESCE($13, ivf_success_rate),
         facilities        = COALESCE($14::jsonb, facilities),
         treatments        = COALESCE($15::jsonb, treatments),
         doctors           = COALESCE($16::jsonb, doctors),
         certifications    = COALESCE($17::jsonb, certifications),
         meta_title        = COALESCE($18, meta_title),
         meta_description  = COALESCE($19, meta_description),
         updated_at        = NOW()
       WHERE user_id = $20
       RETURNING *`,
      [
        name        || null,
        slug        || null,
        description || null,
        city        || null,
        state       || null,
        area        || null,
        address     || null,
        pincode     || null,
        phone       || null,
        email       || null,
        website     || null,
        founded_year       ? parseInt(founded_year)       : null,
        ivf_success_rate   ? parseFloat(ivf_success_rate) : null,
        facilities         ? JSON.stringify(facilities)    : null,
        treatments         ? JSON.stringify(treatments)    : null,
        doctors            ? JSON.stringify(doctors)       : null,
        certifications     ? JSON.stringify(certifications): null,
        meta_title        || null,
        meta_description  || null,
        req.user.id,
      ]
    );

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: { hospital: updated[0] },
    });
  } catch (err) {
    console.error('updateMyProfile error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};

// ── UPLOAD KYC DOCUMENTS ──────────────────────────────────────
// POST /api/hospital/kyc/upload
const uploadKYC = async (req, res) => {
  try {
    const { document_type, document_url } = req.body;

    // document_type: 'registration', 'license', 'tax', 'director_id'
    if (!document_type || !document_url) {
      return res.status(400).json({
        success: false,
        message: 'document_type and document_url are required.',
      });
    }

    // Append doc to kyc_documents array
    const { rows } = await query(
      `UPDATE hospitals
       SET kyc_documents = kyc_documents || $1::jsonb,
           kyc_status    = CASE
             WHEN kyc_status = 'pending' THEN 'under_review'
             ELSE kyc_status
           END,
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING kyc_status, kyc_documents`,
      [
        JSON.stringify([{ type: document_type, url: document_url, uploaded_at: new Date() }]),
        req.user.id,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }

    return res.json({
      success: true,
      message: 'KYC document uploaded. Under review.',
      data: {
        kyc_status:    rows[0].kyc_status,
        kyc_documents: rows[0].kyc_documents,
      },
    });
  } catch (err) {
    console.error('uploadKYC error:', err);
    return res.status(500).json({ success: false, message: 'KYC upload failed.' });
  }
};

// ── GET HOSPITAL ANALYTICS ────────────────────────────────────
// GET /api/hospital/analytics
const getAnalytics = async (req, res) => {
  try {
    const { rows: h } = await query(
      'SELECT id FROM hospitals WHERE user_id = $1',
      [req.user.id]
    );
    if (!h[0]) return res.status(404).json({ success: false, message: 'Not found.' });

    const hospitalId = h[0].id;

    // Leads stats
    const { rows: leadsStats } = await query(
      `SELECT
         COUNT(*)                                         AS total_leads,
         COUNT(*) FILTER (WHERE lu.unlocked_at > NOW() - INTERVAL '7 days')  AS leads_this_week,
         COUNT(*) FILTER (WHERE lu.unlocked_at > NOW() - INTERVAL '30 days') AS leads_this_month
       FROM lead_unlocks lu
       WHERE lu.hospital_id = $1`,
      [hospitalId]
    );

    // Reviews stats
    const { rows: reviewStats } = await query(
      `SELECT
         COUNT(*)                              AS total_reviews,
         COALESCE(AVG(rating),0)::DECIMAL(3,1) AS avg_rating,
         COUNT(*) FILTER (WHERE rating = 5)   AS five_star,
         COUNT(*) FILTER (WHERE rating >= 4)  AS four_plus
       FROM reviews
       WHERE hospital_id = $1 AND status = 'approved'`,
      [hospitalId]
    );

    // Payments stats
    const { rows: payStats } = await query(
      `SELECT
         COALESCE(SUM(amount), 0)                                          AS total_spent_paise,
         COALESCE(SUM(amount) FILTER (WHERE type = 'lead_unlock'), 0)      AS lead_spend_paise,
         COALESCE(SUM(amount) FILTER (WHERE type = 'subscription'), 0)     AS sub_spend_paise
       FROM payments
       WHERE hospital_id = $1 AND status = 'success'`,
      [hospitalId]
    );

    // Subscription
    const { rows: sub } = await query(
      `SELECT plan, status, leads_quota, leads_used,
              trial_ends_at, ends_at
       FROM subscriptions WHERE hospital_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [hospitalId]
    );

    return res.json({
      success: true,
      data: {
        leads:        leadsStats[0],
        reviews:      reviewStats[0],
        payments:     {
          total_spent:  (parseInt(payStats[0].total_spent_paise) / 100).toFixed(2),
          lead_spend:   (parseInt(payStats[0].lead_spend_paise)  / 100).toFixed(2),
          sub_spend:    (parseInt(payStats[0].sub_spend_paise)   / 100).toFixed(2),
        },
        subscription: sub[0] || null,
      },
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch analytics.' });
  }
};

module.exports = {
  listHospitals,
  getHospital,
  getByCity,
  searchHospitals,
  getMyProfile,
  updateMyProfile,
  uploadKYC,
  getAnalytics,
};
