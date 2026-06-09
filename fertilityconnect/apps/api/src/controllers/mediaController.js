// src/controllers/mediaController.js
// Handles file uploads (logo, cover, KYC docs, success stories)

const multer  = require('multer');
const { query } = require('../config/db');
const { uploadToCloudinary, validateFile } = require('../services/mediaService');

// Multer — memory storage (files go to Cloudinary, not disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// ── UPLOAD HOSPITAL LOGO ──────────────────────────────────────
// POST /api/media/logo
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'No file uploaded.' });

    const validation = validateFile(req.file, 'image');
    if (!validation.valid) return res.status(400).json({ success:false, message: validation.error });

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await uploadToCloudinary(base64, 'hospitals/logos');

    if (!result.success) return res.status(500).json({ success:false, message: result.error });

    // Update hospital logo_url
    await query(
      'UPDATE hospitals SET logo_url=$1, updated_at=NOW() WHERE user_id=$2',
      [result.url, req.user.id]
    );

    return res.json({ success:true, message:'Logo uploaded!', data:{ url: result.url } });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Upload failed.' });
  }
};

// ── UPLOAD COVER IMAGE ────────────────────────────────────────
// POST /api/media/cover
const uploadCover = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'No file uploaded.' });

    const validation = validateFile(req.file, 'image');
    if (!validation.valid) return res.status(400).json({ success:false, message: validation.error });

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await uploadToCloudinary(base64, 'hospitals/covers');

    if (!result.success) return res.status(500).json({ success:false, message: result.error });

    await query(
      'UPDATE hospitals SET cover_image_url=$1, updated_at=NOW() WHERE user_id=$2',
      [result.url, req.user.id]
    );

    return res.json({ success:true, message:'Cover image uploaded!', data:{ url: result.url } });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Upload failed.' });
  }
};

// ── UPLOAD KYC DOCUMENT ───────────────────────────────────────
// POST /api/media/kyc
const uploadKYCDoc = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'No file uploaded.' });
    const { document_type } = req.body;
    if (!document_type) return res.status(400).json({ success:false, message:'document_type required.' });

    const validation = validateFile(req.file, 'image');
    if (!validation.valid) return res.status(400).json({ success:false, message: validation.error });

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await uploadToCloudinary(base64, 'kyc_documents');

    if (!result.success) return res.status(500).json({ success:false, message: result.error });

    const newDoc = { type: document_type, url: result.url, uploaded_at: new Date() };

    const { rows } = await query(
      `UPDATE hospitals
       SET kyc_documents = kyc_documents || $1::jsonb,
           kyc_status    = CASE WHEN kyc_status='pending' THEN 'under_review' ELSE kyc_status END,
           updated_at    = NOW()
       WHERE user_id=$2
       RETURNING kyc_status, kyc_documents`,
      [JSON.stringify([newDoc]), req.user.id]
    );

    return res.json({
      success: true,
      message: 'KYC document uploaded! Under review.',
      data:    { url: result.url, kyc_status: rows[0]?.kyc_status },
    });
  } catch(err) {
    return res.status(500).json({ success:false, message:'KYC upload failed.' });
  }
};

// ── UPLOAD GALLERY IMAGE ──────────────────────────────────────
// POST /api/media/gallery
const uploadGallery = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'No file uploaded.' });

    const validation = validateFile(req.file, 'image');
    if (!validation.valid) return res.status(400).json({ success:false, message: validation.error });

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await uploadToCloudinary(base64, 'hospitals/gallery');

    if (!result.success) return res.status(500).json({ success:false, message: result.error });

    await query(
      `UPDATE hospitals
       SET gallery_urls = gallery_urls || $1::jsonb,
           updated_at   = NOW()
       WHERE user_id=$2`,
      [JSON.stringify([result.url]), req.user.id]
    );

    return res.json({ success:true, message:'Gallery image uploaded!', data:{ url: result.url } });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Upload failed.' });
  }
};

// ── SUCCESS STORIES ───────────────────────────────────────────
// POST /api/media/story
const addSuccessStory = async (req, res) => {
  try {
    const { title, story, patient_name, treatment, outcome } = req.body;

    // Get hospital id
    const { rows: h } = await query(
      'SELECT id FROM hospitals WHERE user_id=$1', [req.user.id]
    );
    if (!h[0]) return res.status(404).json({ success:false, message:'Hospital not found.' });

    // Upload image if provided
    let imageUrl = null;
    if (req.file) {
      const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const result = await uploadToCloudinary(base64, 'success_stories');
      if (result.success) imageUrl = result.url;
    }

    const { rows } = await query(
      `INSERT INTO success_stories
         (hospital_id, title, story, patient_name, treatment, outcome, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, status`,
      [h[0].id, title||null, story||null, patient_name||null,
       treatment||null, outcome||null, imageUrl]
    );

    return res.status(201).json({
      success: true,
      message: 'Success story submitted! Will appear after admin approval.',
      data:    { story: rows[0] },
    });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Failed to add story.' });
  }
};

// GET /api/media/stories/:hospitalId
const getSuccessStories = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, title, story, patient_name, treatment,
              outcome, image_url, video_url, created_at
       FROM success_stories
       WHERE hospital_id=$1 AND status='approved'
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.params.hospitalId]
    );
    return res.json({ success:true, data:{ stories: rows } });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Failed to fetch stories.' });
  }
};

module.exports = {
  upload,
  uploadLogo, uploadCover, uploadKYCDoc, uploadGallery,
  addSuccessStory, getSuccessStories,
};
