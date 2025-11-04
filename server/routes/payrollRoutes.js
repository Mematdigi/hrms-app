const express = require('express');
const { generatePayroll, getPayroll, processPayroll, payPayroll } = require('../controllers/payrollController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/generate', authMiddleware, roleMiddleware(['admin', 'hr']), generatePayroll);
router.get('/', authMiddleware, getPayroll);
router.post('/process', authMiddleware, roleMiddleware(['admin', 'hr']), processPayroll);
router.post('/pay', authMiddleware, roleMiddleware(['admin', 'hr']), payPayroll);

module.exports = router;
