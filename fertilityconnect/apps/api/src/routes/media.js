// src/routes/media.js

const router = require('express').Router();
const auth   = require('../middleware/auth');
const rbac   = require('../middleware/rbac');
const { query } = require('../config/db');
const {
  upload,
  uploadLogo, uploadCover, uploadKYCDoc, uploadGallery,
  addSuccessStory, getSuccessStories,
} = require('../controllers/mediaController');

// ── Hospital Media (protected) ─────────────────────────────────
router.post('/logo',    auth, rbac('hospital'), upload.single('file'), uploadLogo);
router.post('/cover',   auth, rbac('hospital'), upload.single('file'), uploadCover);
router.post('/kyc',     auth, rbac('hospital'), upload.single('file'), uploadKYCDoc);
router.post('/gallery', auth, rbac('hospital'), upload.single('file'), uploadGallery);
router.post('/story',   auth, rbac('hospital'), upload.single('image'), addSuccessStory);

// ── Public ────────────────────────────────────────────────────
router.get('/stories/:hospitalId', getSuccessStories);

// ── Callback Request (anyone can submit) ─────────────────────
// POST /api/media/callback
router.post('/callback', async (req, res) => {
  try {
    const { hospital_id, patient_name, phone, city, message } = req.body;
    if (!hospital_id || !phone)
      return res.status(400).json({ success:false, message:'hospital_id and phone required.' });

    await query(
      `INSERT INTO callback_requests (hospital_id, patient_name, phone, city, message)
       VALUES ($1,$2,$3,$4,$5)`,
      [hospital_id, patient_name||'Anonymous', phone, city||null, message||null]
    );

    // Notify hospital
    const { rows: h } = await query(
      'SELECT u.phone AS hphone FROM hospitals h JOIN users u ON u.id=h.user_id WHERE h.id=$1',
      [hospital_id]
    );
    if (h[0]) {
      const { sendSMS } = require('../services/notificationService');
      await sendSMS(h[0].hphone,
        `FertilityConnect: Callback requested from ${city||'a patient'}. Login to respond: fertilityconnect.in/dashboard`
      );
    }

    return res.status(201).json({
      success: true,
      message: '📞 Callback request submitted! The hospital will call you shortly.',
    });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Failed to submit callback request.' });
  }
});

// ── Hospital: View callback requests ─────────────────────────
// GET /api/media/callbacks
router.get('/callbacks', auth, rbac('hospital'), async (req, res) => {
  try {
    const { rows: h } = await query(
      'SELECT id FROM hospitals WHERE user_id=$1', [req.user.id]
    );
    if (!h[0]) return res.status(404).json({ success:false, message:'Not found.' });

    const { rows } = await query(
      `SELECT id, patient_name, phone, city, message, status, created_at
       FROM callback_requests
       WHERE hospital_id=$1
       ORDER BY created_at DESC`,
      [h[0].id]
    );
    return res.json({ success:true, data:{ callbacks: rows } });
  } catch(err) {
    return res.status(500).json({ success:false, message:'Failed.' });
  }
});

module.exports = router;
