const express = require('express');
const router = express.Router();

const scoringController = require('../../controllers/scoringController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

// ── Own scores (all roles)
router.get('/me', authMiddleware, scoringController.getMyScores);

// ── TL / Manager: team scores
router.get(
  '/team',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  scoringController.getTeamScores
);

// ── HR / Manager / Admin: company-wide with filters
router.get(
  '/company',
  authMiddleware,
  roleMiddleware(['hr', 'manager', 'admin']),
  scoringController.getCompanyScores
);

// ── Nakshatra Award leaderboard (role-scoped inside controller)
router.get('/nakshatra-leaderboard', authMiddleware, scoringController.getNakshatra);

// ── Scoring rules config — read for HR+, edit for admin/hr
router.get('/config',  authMiddleware, roleMiddleware(['hr', 'manager', 'admin']), scoringController.getConfig);
router.put('/config',  authMiddleware, roleMiddleware(['hr', 'admin']),            scoringController.updateConfig);

// ── Manual recompute + month-end finalize
router.post('/recalculate', authMiddleware, roleMiddleware(['hr', 'admin']), scoringController.recalculate);
router.post('/finalize',    authMiddleware, roleMiddleware(['admin']),       scoringController.finalize);

// ── Feedback + recommendations
router.post('/feedback',       authMiddleware, scoringController.addFeedback);
router.post('/recommendation', authMiddleware, roleMiddleware(['tl', 'hr', 'manager', 'admin']), scoringController.addRecommendation);
router.get('/feedback/:employeeId', authMiddleware, scoringController.getFeedback);

// ── One employee's trend (TL scoped to own team inside controller)
router.get(
  '/employee/:id',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  scoringController.getEmployeeScores
);

module.exports = router;
