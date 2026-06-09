// src/routes/reviews.js

const router = require('express').Router();
const auth   = require('../middleware/auth');
const rbac   = require('../middleware/rbac');
const { submitReview, getMyReviews } = require('../controllers/reviewController');

// POST /api/reviews        → Submit a review (patient only)
router.post('/',  auth, rbac('client'),  submitReview);

// GET  /api/reviews/my     → My reviews (patient)
router.get('/my', auth, rbac('client'),  getMyReviews);

module.exports = router;
