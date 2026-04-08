const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const officeDocumentController = require('../../controllers/officeDocumentController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../../../uploads/office-documents/');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file,  cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `office-doc-${unique}${path.extname(file.originalname)}`);
  },
});

const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/zip', 'application/x-zip-compressed',
];

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    ALLOWED_MIMES.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error(`File type "${file.mimetype}" is not allowed`)),
});

// Static routes BEFORE /:id
router.get('/stats',         authMiddleware, officeDocumentController.getStats);
router.get('/',              authMiddleware, officeDocumentController.getAll);
router.get('/:id',           authMiddleware, officeDocumentController.getById);
router.get('/:id/download',  authMiddleware, officeDocumentController.download);
router.get('/:id/preview',   authMiddleware, officeDocumentController.preview);

router.post('/',   authMiddleware, roleMiddleware(['admin', 'hr']), upload.single('documentFile'), officeDocumentController.create);
router.put('/:id', authMiddleware, roleMiddleware(['admin', 'hr']), upload.single('documentFile'), officeDocumentController.update);
router.delete('/:id', authMiddleware, roleMiddleware(['admin', 'hr']), officeDocumentController.delete);

module.exports = router;