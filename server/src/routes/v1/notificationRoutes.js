// src/routes/v1/notificationRoutes.js
const express = require('express');
const router  = express.Router();

const { authMiddleware, roleMiddleware }  = require('../../middleware/auth');
const { notificationController }         = require('../../controllers/Notificationcontroller');

// ── Get notifications (paginated, filterable) ──────────────────────────────────
// Employee → own only | HR/Admin/Manager → all
// Query: ?page=1&limit=20&unread=true&type=leave_applied
router.get('/',              authMiddleware, notificationController.getNotifications);

// ── Unread count — for bell badge ─────────────────────────────────────────────
router.get('/unread-count',  authMiddleware, notificationController.getUnreadCount);

// ── Mark ALL as read ───────────────────────────────────────────────────────────
router.put('/mark-all-read', authMiddleware, notificationController.markAllRead);

// ── Clear all ─────────────────────────────────────────────────────────────────
router.delete('/clear-all',  authMiddleware, notificationController.clearAll);

// ── Mark single as read ───────────────────────────────────────────────────────
router.put('/:id/read',      authMiddleware, notificationController.markAsRead);

// ── Delete single ─────────────────────────────────────────────────────────────
router.delete('/:id',        authMiddleware, notificationController.deleteNotification);

module.exports = router;