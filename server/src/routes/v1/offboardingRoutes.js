const express = require('express');
const offboardingController = require('../../controllers/offboardingController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

// =============================================================
// All routes require authentication
// Static routes MUST come before /:id dynamic routes
// =============================================================

// GET  /offboarding               — list all records (HR/admin/manager)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager']),
  offboardingController.getAll
);

// GET  /offboarding/employee/:employeeId — get record by employee
router.get(
  '/employee/:employeeId',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager']),
  offboardingController.getByEmployee
);

// POST /offboarding               — create offboarding record (HR/admin)
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['admin', 'hr']),
  offboardingController.create
);

// GET  /offboarding/:id           — get single record
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager']),
  offboardingController.getById
);

// PUT  /offboarding/:id           — update record (HR/admin)
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin', 'hr']),
  offboardingController.update
);

// PATCH /offboarding/:id/complete — mark as completed (HR/admin)
router.patch(
  '/:id/complete',
  authMiddleware,
  roleMiddleware(['admin', 'hr']),
  offboardingController.markComplete
);

// DELETE /offboarding/:id         — delete record (admin only)
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin']),
  offboardingController.delete
);

module.exports = router;