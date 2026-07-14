const express = require('express');
const { regularizationController } = require('../../controllers');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

// Employee routes
router.post('/', authMiddleware, regularizationController.submitRequest);
router.get('/my', authMiddleware, regularizationController.getMyRequests);

// HR/Admin/Manager routes
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager']),
  regularizationController.getAllRequests
);
router.put(
  '/:id/approve',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager']),
  regularizationController.approveRequest
);
router.put(
  '/:id/reject',
  authMiddleware,
  roleMiddleware(['admin', 'hr', 'manager']),
  regularizationController.rejectRequest
);

module.exports = router;