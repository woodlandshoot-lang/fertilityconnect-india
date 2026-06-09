// src/controllers/reviewController.js

const { query } = require('../config/db');

// ── SUBMIT REVIEW (Patient) ───────────────────────────────────
// POST /api/reviews
const submitReview = async (req, res) => {
  try {
    const {
      hospital_id, rating, title, text,
      video_url, is_anonymous = true,
      display_name, treatment, outcome,
    } = req.body;

    if (!hospital_id || !rating) {
      return res.status(400).json({
        success: false,
        message: 'hospital_id and rating are required.',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5.',
      });
    }

    // Check hospital exists
    const { rows: h } = await query(
      'SELECT id FROM hospitals WHERE id = $1 AND is_active = TRUE',
      [hospital_id]
    );
    if (!h[0]) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found.',
      });
    }

    // Check duplicate review
    const { rows: dup } = await query(
      'SELECT id FROM reviews WHERE hospital_id = $1 AND client_id = $2',
      [hospital_id, req.user.id]
    );
    if (dup[0]) {
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this hospital.',
      });
    }

    const { rows: [review] } = await query(
      `INSERT INTO reviews
         (hospital_id, client_id, rating, title, text,
          video_url, is_anonymous, display_name, treatment, outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, rating, status, created_at`,
      [
        hospital_id, req.user.id, rating,
        title || null, text || null,
        video_url || null,
        is_anonymous,
        display_name || null,
        treatment || null,
        outcome || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Review submitted! It will be visible after moderation (24hrs).',
      data: { review },
    });
  } catch (err) {
    console.error('submitReview error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit review.' });
  }
};

// ── MY REVIEWS (Patient) ──────────────────────────────────────
// GET /api/reviews/my
const getMyReviews = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT r.*, h.name AS hospital_name, h.slug AS hospital_slug
       FROM reviews r
       JOIN hospitals h ON h.id = r.hospital_id
       WHERE r.client_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    return res.json({ success: true, data: { reviews: rows } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch reviews.' });
  }
};

module.exports = { submitReview, getMyReviews };
