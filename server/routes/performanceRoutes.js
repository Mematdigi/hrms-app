const express = require('express');
const { createReview, getReviews, updateReview, submitReview } = require('../controllers/performanceController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/create', authMiddleware, roleMiddleware(['admin', 'hr', 'manager']), createReview);
router.get('/', authMiddleware, getReviews);
router.put('/:reviewId', authMiddleware, roleMiddleware(['admin', 'hr', 'manager']), updateReview);
router.post('/submit', authMiddleware, roleMiddleware(['admin', 'hr', 'manager']), submitReview);

module.exports = router;
