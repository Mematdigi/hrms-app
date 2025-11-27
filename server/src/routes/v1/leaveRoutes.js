const express = require('express');
const router = express.Router();

const { authMiddleware, roleMiddleware } = require('../../middleware/auth'); // ✅
const {leaveController} = require('../../controllers/index');

// Apply for leave (Employee)
router.post('/apply', authMiddleware, leaveController.applyLeave);

// Get leave requests
router.get('/requests', authMiddleware, leaveController.getLeaveRequests);

// Get pending leave requests (for HR approval)
router.get('/pending', authMiddleware, leaveController.getPendingLeaveRequests);

// Get leave statistics
router.get('/stats', authMiddleware, leaveController.getLeaveStats);

// Approve leave (HR only)
router.put('/approve', authMiddleware, roleMiddleware(['hr']), leaveController.approveLeave);

// Reject leave (HR only)
router.put('/reject', authMiddleware, roleMiddleware(['hr']), leaveController.rejectLeave);

router.get('/defaults', leaveController.getDefaults);  // Get default leave settings
router.put('/defaults', authMiddleware, roleMiddleware(['hr']), leaveController.updateDefaults);  // Update default leave settings (HR only)


module.exports = router;
