const express = require('express');
const {payrollController} = require('../../controllers');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

router.post('/generate', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.generatePayroll);
router.get('/', authMiddleware, payrollController.getPayroll);
router.post('/process', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.processPayroll);
router.post('/pay', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.payPayroll);

module.exports = router;
