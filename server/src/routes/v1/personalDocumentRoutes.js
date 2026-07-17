const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const PersonalDocumentController = require('../../controllers/PersonalDocumentController')
const { authMiddleware } = require('../../middleware/auth');

const router = express.Router();

// ── Ensure upload directory exists ────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../../../uploads/personal-documents/');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Multer Config ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file,  cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `personal-${unique}${path.extname(file.originalname)}`);
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
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
];

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed`));
    }
  },
});

// ── Routes ─────────────────────────────────────────────────────────────────
// All routes require authentication; ownership enforced in controller.

router.get('/stats',        authMiddleware, PersonalDocumentController.getStats);
router.get('/',             authMiddleware, PersonalDocumentController.getMyDocuments);
router.get('/:id',          authMiddleware, PersonalDocumentController.getById);
router.get('/:id/download', authMiddleware, PersonalDocumentController.download);
router.get('/:id/preview',  authMiddleware, PersonalDocumentController.preview);

router.post('/',   authMiddleware, upload.single('documentFile'), PersonalDocumentController.create);
router.put('/:id', authMiddleware, upload.single('documentFile'), PersonalDocumentController.update);
router.delete('/:id', authMiddleware, PersonalDocumentController.delete);

module.exports = router;