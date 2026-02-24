const express = require('express');
const router  = express.Router();

const { authMiddleware, roleMiddleware } = require('../../middleware/auth');
const { leaveController }               = require('../../controllers/index');

// ── Employee routes ────────────────────────────────────────────────────────
// Apply for leave
router.post('/apply',    authMiddleware, leaveController.applyLeave);

// Get own leave requests (employee) or all (hr/admin/manager)
router.get('/requests',  authMiddleware, leaveController.getLeaveRequests);

// Get leave statistics (pending/approved/rejected counts)
router.get('/stats',     authMiddleware, leaveController.getLeaveStats);

// ── HR / Admin routes ──────────────────────────────────────────────────────
// Get all pending requests
router.get('/pending',   authMiddleware, leaveController.getPendingLeaveRequests);

// Approve leave
router.put('/approve',   authMiddleware, roleMiddleware(['hr', 'admin', 'manager']), leaveController.approveLeave);

// Reject leave
router.put('/reject',    authMiddleware, roleMiddleware(['hr', 'admin', 'manager']), leaveController.rejectLeave);

// ── Leave defaults (global settings) ──────────────────────────────────────
router.get('/defaults',  leaveController.getDefaults);
router.put('/defaults',  authMiddleware, roleMiddleware(['hr', 'admin']), leaveController.updateDefaults);

// ── Employee leave balances ────────────────────────────────────────────────
// GET  /leave/balances/:employeeId  → get computed balances for one employee
// PUT  /leave/balances/:employeeId  → HR updates allocation for one employee
router.get('/balances/:employeeId',  authMiddleware, leaveController.getEmployeeBalances);
router.put('/balances/:employeeId',  authMiddleware, roleMiddleware(['hr', 'admin']), leaveController.updateEmployeeBalances);

module.exports = router;