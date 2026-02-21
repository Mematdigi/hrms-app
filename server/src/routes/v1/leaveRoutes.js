const express = require('express');
const router  = express.Router();

const { authMiddleware, roleMiddleware } = require('../../middleware/auth');
const { leaveController }               = require('../../controllers/index');

// Apply for leave (Employee / HR / Manager)
router.post('/apply', authMiddleware, leaveController.applyLeave);

// Get leave requests (role-based filtering via query params)
router.get('/requests', authMiddleware, leaveController.getLeaveRequests);

// Get pending leave requests (for HR approval panel)
router.get('/pending', authMiddleware, leaveController.getPendingLeaveRequests);

// Get leave statistics (counts of pending / approved / rejected)
router.get('/stats', authMiddleware, leaveController.getLeaveStats);

// Approve leave (HR only)
router.put('/approve', authMiddleware, roleMiddleware(['hr']), leaveController.approveLeave);

// Reject leave (HR only)
router.put('/reject', authMiddleware, roleMiddleware(['hr']), leaveController.rejectLeave);

// Get / Update default leave settings
router.get('/defaults',                                                   leaveController.getDefaults);
router.put('/defaults', authMiddleware, roleMiddleware(['hr']),            leaveController.updateDefaults);

// ✅ NEW: Get leave balances for a specific employee
// Called by frontend: leaveAPI.getBalances(employeeId) → GET /leave/balances/:employeeId
router.get('/balances/:employeeId', authMiddleware, leaveController.getEmployeeBalances);

module.exports = router;