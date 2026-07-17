// server/routes/roleRoutes.js
const express = require('express');
const router = express.Router();
const roleController = require('../../controllers/roleController');
const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

// Get all users (admin only)

console.log('authMiddleware type:', typeof authMiddleware);

router.get('/users', authMiddleware, roleMiddleware(['admin']), roleController.getAllUsers);

// Get user by ID (admin only, if you wish)
router.get('/users/:id', authMiddleware, roleMiddleware(['admin']), roleController.getUserById);

// Update user role (admin only)
router.put('/users/:userId/role', authMiddleware, roleMiddleware(['admin']), roleController.updateUserRole);

module.exports = router;