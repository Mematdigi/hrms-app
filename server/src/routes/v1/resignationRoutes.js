// src/routes/v1/resignationRoutes.js

const express            = require('express');
const resignationCtrl    = require('../../controllers/resignationController'); // src/routes/v1/ → ../../ → src/ → controllers/
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Static named routes (/my) MUST be declared before dynamic /:id
// ─────────────────────────────────────────────────────────────────────────────

// POST /v1/resignations          — Employee: submit a new resignation
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['employee', 'manager', 'hr', 'admin']),
  resignationCtrl.submit
);

// GET /v1/resignations/my        — Employee: view their own latest resignation
router.get(
  '/my',
  authMiddleware,
  resignationCtrl.getMine
);

// DELETE /v1/resignations/my     — Employee: withdraw their own pending resignation
router.delete(
  '/my',
  authMiddleware,
  resignationCtrl.withdrawMine
);

// GET /v1/resignations           — HR/Admin: list all (optional ?status=pending|accepted|rejected)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager']),
  resignationCtrl.getAll
);

// PUT /v1/resignations/:id/accept — HR/Admin: accept
router.put(
  '/:id/accept',
  authMiddleware,
  roleMiddleware(['admin', 'hr']),
  resignationCtrl.accept
);

// PUT /v1/resignations/:id/reject — HR/Admin: reject (body: { rejectionReason })
router.put(
  '/:id/reject',
  authMiddleware,
  roleMiddleware(['admin', 'hr']),
  resignationCtrl.reject
);

// GET /v1/resignations/:id       — HR/Admin: single resignation detail (keep last)
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager']),
  resignationCtrl.getById
);

module.exports = router;