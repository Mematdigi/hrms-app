const express = require('express');
const { attendanceController } = require('../../controllers');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();


// Employee routes
router.post('/check-in', authMiddleware, attendanceController.checkIn);
router.post('/check-out', authMiddleware, attendanceController.checkOut);
router.post('/request-early-checkout', authMiddleware, attendanceController.requestEarlyCheckout);
router.get('/', authMiddleware, attendanceController.getAttendance);
router.get('/calendar', authMiddleware, attendanceController.getCalendarData);

// HR/Admin/Manager routes
router.post('/mark', authMiddleware, roleMiddleware(['admin', 'hr', 'manager']), attendanceController.markAttendance);
router.get(
    '/attendance_list',
    authMiddleware,
    roleMiddleware(['admin', 'hr', 'manager']),
    attendanceController.getAttendanceList
);
router.get(
    '/pending-requests',
    authMiddleware,
    roleMiddleware(['admin', 'hr', 'manager']),
    attendanceController.getPendingRequests
);
router.post(
    '/approve-early-checkout',
    authMiddleware,
    roleMiddleware(['admin', 'hr', 'manager']),
    attendanceController.approveEarlyCheckout
);


// // Employee routes
// router.post('/checkin', authenticate, attendanceController.checkIn);
// router.post('/checkout', authenticate, attendanceController.checkOut);
// router.post('/request-early-checkout', authenticate, attendanceController.requestEarlyCheckout);
// router.get('/', authenticate, attendanceController.getAttendance);
// router.get('/calendar', authenticate, attendanceController.getCalendarData);

// // HR/Admin routes
// router.get('/list', authenticate, authorizeRoles('hr', 'admin'), attendanceController.getAttendanceList);
// router.get('/pending-requests', authenticate, authorizeRoles('hr', 'admin'), attendanceController.getPendingRequests);
// router.post('/approve-early-checkout', authenticate, authorizeRoles('hr', 'admin'), attendanceController.approveEarlyCheckout);
// router.post('/mark', authenticate, authorizeRoles('hr', 'admin'), attendanceController.markAttendance);


module.exports = router;
