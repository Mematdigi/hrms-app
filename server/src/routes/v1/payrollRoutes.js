const express            = require('express');
const payrollController  = require('../../controllers/payrollController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

// ── Payroll Generation ───────────────────────────────────────────────────────

// Auto-generate payroll for a single employee (reads all data from DB)
router.post('/generate', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.generatePayroll);

// Auto-generate payroll for ALL active employees in one click
router.post('/generate-all', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.generateAllPayrolls);

// ── Payroll Records ──────────────────────────────────────────────────────────

// Get payroll records (employees see own, HR sees all via query params)
router.get('/', authMiddleware, payrollController.getPayroll);

// Get single payroll with live breakdown (for payslip modal)
router.get('/breakdown/:payrollId', authMiddleware, payrollController.getPayrollBreakdown);

// ── Status Transitions ───────────────────────────────────────────────────────

// Move payroll from draft → processed
router.post('/process', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.processPayroll);

// Move payroll from processed → paid
router.post('/pay', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.payPayroll);

// ── Payslip Download Requests ────────────────────────────────────────────────

// Employee: submit a download request with reason
router.post('/download-requests', authMiddleware, payrollController.requestDownload);

// Employee: view own request history
router.get('/download-requests/my', authMiddleware, payrollController.getMyDownloadRequests);

// Employee: check download permission for a specific payroll
router.get('/download-requests/check/:payrollId', authMiddleware, payrollController.checkDownloadPermission);

// HR: view pending (or all) requests — ?status=all for full history
router.get('/download-requests', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.getPendingDownloadRequests);

// HR: approve a request
router.post('/download-requests/approve', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.approveDownloadRequest);

// HR: reject a request with a reason
router.post('/download-requests/reject', authMiddleware, roleMiddleware(['admin', 'hr']), payrollController.rejectDownloadRequest);

module.exports = router;