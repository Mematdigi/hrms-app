const express            = require('express');
const payrollController  = require('../../controllers/payrollController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

// Auto-generate payroll for a single employee (reads all data from DB)
router.post('/generate', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.generatePayroll);

// Auto-generate payroll for ALL active employees in one click
router.post('/generate-all', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.generateAllPayrolls);

// Get payroll records (employees see own, HR sees all via query params)
router.get('/', authMiddleware, payrollController.getPayroll);

// Get single payroll with live breakdown (for payslip modal)
router.get('/breakdown/:payrollId', authMiddleware, payrollController.getPayrollBreakdown);

// Move payroll from draft → processed
router.post('/process', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.processPayroll);

// Move payroll from processed → paid
router.post('/pay', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.payPayroll);

module.exports = router;