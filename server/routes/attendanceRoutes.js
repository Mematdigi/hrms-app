const express = require('express');
const { checkIn, checkOut, getAttendance, markAttendance } = require('../controllers/attendanceController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/check-in', authMiddleware, checkIn);
router.post('/check-out', authMiddleware, checkOut);
router.get('/', authMiddleware, getAttendance);
router.post('/mark', authMiddleware, roleMiddleware(['admin', 'hr', 'manager']), markAttendance);

module.exports = router;
