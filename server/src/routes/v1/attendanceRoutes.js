const express = require('express');
const { attendanceController } = require('../../controllers');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

router.post('/check-in', authMiddleware, attendanceController.checkIn);
router.post('/check-out', authMiddleware, attendanceController.checkOut);
router.get('/', authMiddleware, attendanceController.getAttendance);
router.post('/mark', authMiddleware, roleMiddleware(['admin', 'hr', 'manager']), attendanceController.markAttendance);
router.get(
    '/attendance_list',
    authMiddleware,
    roleMiddleware(['admin', 'hr', 'manager']),
    attendanceController.getAttendanceList
);

module.exports = router;
