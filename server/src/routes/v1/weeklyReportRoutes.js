const express = require('express');
const router = express.Router();

const weeklyReportController = require('../../controllers/weeklyReportController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

// ── TL: submit a weekly report for a team member
// (admin/hr/manager may also submit if ever needed)
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  weeklyReportController.submitReport
);

// ── TL: edit own report inside the configurable edit window
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['tl']),
  weeklyReportController.updateReport
);

// ── List/audit: TL sees own; HR/Manager/Admin see all (?teamLead=&employee=&week=)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  weeklyReportController.getReports
);

// ── HR/Manager: annotate only (never silently alter TL input)
router.put(
  '/:id/annotate',
  authMiddleware,
  roleMiddleware(['hr', 'manager', 'admin']),
  weeklyReportController.annotateReport
);

module.exports = router;
