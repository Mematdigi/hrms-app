const express = require('express');
const taskSheetController = require('../../controllers/taskSheetController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

const router = express.Router();

// Employee routes
router.post('/', authMiddleware, taskSheetController.submit);
router.get('/my', authMiddleware, taskSheetController.getMine);

// TL (own team only, scoped in controller) / Manager / HR / Admin
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  taskSheetController.getAll
);
router.put(
  '/:id/review',
  authMiddleware,
  roleMiddleware(['tl', 'manager', 'hr', 'admin']),
  taskSheetController.review
);

module.exports = router;
