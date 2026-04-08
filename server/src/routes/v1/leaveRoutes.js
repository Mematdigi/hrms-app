const express = require('express');
const router  = express.Router();
const multer  = require('multer');

const { authMiddleware, roleMiddleware } = require('../../middleware/auth');
const { leaveController }               = require('../../controllers/index');

// ── Multer: in-memory storage for Excel file ──────────────────────────────
const excelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel',                                           // .xls
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ── Employee routes ────────────────────────────────────────────────────────
router.post('/apply',    authMiddleware, leaveController.applyLeave);
router.get('/requests',  authMiddleware, leaveController.getLeaveRequests);
router.get('/stats',     authMiddleware, leaveController.getLeaveStats);

// ── HR / Admin routes ──────────────────────────────────────────────────────
router.get('/pending',   authMiddleware, leaveController.getPendingLeaveRequests);
router.put('/approve',   authMiddleware, roleMiddleware(['hr', 'admin', 'manager']), leaveController.approveLeave);
router.put('/reject',    authMiddleware, roleMiddleware(['hr', 'admin', 'manager']), leaveController.rejectLeave);

// ── Leave defaults ─────────────────────────────────────────────────────────
router.get('/defaults',  leaveController.getDefaults);
router.put('/defaults',  authMiddleware, roleMiddleware(['hr', 'admin']), leaveController.updateDefaults);

// ── Employee leave balances ────────────────────────────────────────────────
router.get('/balances/:employeeId', authMiddleware, leaveController.getEmployeeBalances);
router.put('/balances/:employeeId', authMiddleware, roleMiddleware(['hr', 'admin']), leaveController.updateEmployeeBalances);

// ── Bulk leave upload (HR / Admin only) ───────────────────────────────────
// GET  /leave/bulk/template  → download blank .xlsx template
// POST /leave/bulk/upload    → upload filled .xlsx to create leave records
router.get(
  '/bulk/template',
  authMiddleware,
  roleMiddleware(['hr', 'admin']),
  leaveController.downloadLeaveTemplate
);

router.post(
  '/bulk/upload',
  authMiddleware,
  roleMiddleware(['hr', 'admin']),
  excelUpload.single('leaveFile'),
  leaveController.bulkUploadLeaves
);

// ── HR: get ALL leaves with filters (for "View Leave Data" modal) ──────────
// GET /leave/hr/all?leaveType=sick&status=approved&startDate=...&endDate=...
router.get(
  '/hr/all',
  authMiddleware,
  roleMiddleware(['hr', 'admin', 'manager']),
  leaveController.getAllLeavesHR
);

module.exports = router;