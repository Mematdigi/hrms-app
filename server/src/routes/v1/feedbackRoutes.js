const express = require('express');
const feedbackController = require('../../controllers/feedbackController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

// Recommendations — TL/Manager/HR/Admin only (they carry point weights)
router.post(
  '/recommendation',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  feedbackController.createRecommendation
);
router.get('/recommendations', authMiddleware, feedbackController.getRecommendations);

// Feedback — any authenticated user (peer feedback counts −1)
router.post('/', authMiddleware, feedbackController.createFeedback);
router.get('/', authMiddleware, feedbackController.getFeedback);

module.exports = router;
