const express = require('express');
const employeeController = require('../../controllers/employeeController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// --- Multer Config ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/'); // Ensure this folder exists!
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage: storage });

const uploadFields = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'adharCard', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'salarySlip', maxCount: 1 },
  { name: 'relievingLetter', maxCount: 1 },
  { name: 'experienceLetter', maxCount: 1 },
  { name: 'offerLetter', maxCount: 1 }
]);

// --- Routes ---
router.get('/', authMiddleware, employeeController.getAllEmployees);
router.get('/:id', authMiddleware, employeeController.getEmployeeById);

// Create Employee (With File Uploads)
router.post('/', 
  authMiddleware, 
  roleMiddleware(['admin', 'hr','manager','employee']), 
  uploadFields, 
  employeeController.createEmployee
);

router.put('/:id', authMiddleware, roleMiddleware(['admin', 'hr','manager','employee']), uploadFields, employeeController.updateEmployee);
router.delete('/:id', authMiddleware, roleMiddleware(['admin','manager']), employeeController.deleteEmployee);
router.get('/all/payrolls', authMiddleware, roleMiddleware(['admin','hr','manager']), employeeController.getEmployeePayrolls);

module.exports = router;