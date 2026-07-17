const express = require('express');
const employeeController = require('../../controllers/employeeController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// --- Multer Config for Documents (disk storage) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/');
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage: storage });

// --- Multer Config for Bulk Import (memory storage) ---
const excelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadFields = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'adharCard', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'salarySlip', maxCount: 1 },
  { name: 'relievingLetter', maxCount: 1 },
  { name: 'experienceLetter', maxCount: 1 },
  { name: 'offerLetter', maxCount: 1 }
]);

// =============================================================
// IMPORTANT: Static routes MUST come before /:id dynamic routes
// =============================================================

// Bulk Import (POST /employees/bulk-import)
router.post(
  '/bulk-import',
  authMiddleware,
  roleMiddleware(['admin', 'hr']),
  excelUpload.single('excelFile'),
  employeeController.bulkImportEmployees
);

// Download uploaded bulk excel (GET /employees/bulk-import/download/:filename)
router.get(
  '/bulk-import/download/:filename',
  authMiddleware,
  roleMiddleware(['admin', 'hr']),
  employeeController.downloadUploadedExcel
);

// Payrolls (GET /employees/all/payrolls)
router.get(
  '/all/payrolls',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager']),
  employeeController.getEmployeePayrolls
);

// Standard CRUD
router.get('/', authMiddleware, employeeController.getAllEmployees);

router.post(
  '/',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager', 'employee']),
  uploadFields,
  employeeController.createEmployee
);

// Bulk Delete (DELETE /employees/bulk/delete) — admin only
router.delete(
  '/bulk/delete',
  authMiddleware,
  roleMiddleware(['admin']),
  employeeController.bulkDeleteEmployees
);

// Dynamic /:id routes — ALWAYS LAST
router.get('/:id', authMiddleware, employeeController.getEmployeeById);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager', 'employee']),
  uploadFields,
  employeeController.updateEmployee
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin', 'hr']),
  employeeController.deleteEmployee
);

module.exports = router;