const express = require('express');
const router = express.Router();

const taskReportController = require('../../controllers/taskReportController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

// ── EMPLOYEE: read-only view of the task reports their TL logged for them ──
// (Employees can NEVER create or edit a task report — TL owns this data.)
router.get('/my', authMiddleware, taskReportController.getMyReports);

// ── TL: create / edit / delete task reports for their own team members ─────
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  taskReportController.createReport
);
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  taskReportController.updateReport
);
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  taskReportController.deleteReport
);

// ── TL (own team) / Manager / HR / Admin (all): list task reports ──────────
router.get(
  '/team',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  taskReportController.getTeamReports
);

module.exports = router;
