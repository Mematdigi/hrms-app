// src/controllers/Notificationcontroller.js
const Notification = require('../models/Notification');
const User         = require('../models/User');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Create a single notification
// Usage: await createNotification({ recipient, sender, type, title, message, refId, refModel, meta })
// ─────────────────────────────────────────────────────────────────────────────
const createNotification = async ({ recipient, sender = null, type, title, message, refId = null, refModel = null, meta = {} }) => {
  try {
    const notif = await Notification.create({ recipient, sender, type, title, message, refId, refModel, meta });
    return notif;
  } catch (err) {
    console.error('createNotification error:', err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Notify ALL HR users (used when employee applies leave / requests payslip)
// ─────────────────────────────────────────────────────────────────────────────
const notifyAllHR = async ({ sender, type, title, message, refId = null, refModel = null, meta = {} }) => {
  try {
    const hrUsers = await User.find({ role: { $in: ['hr', 'admin'] }, isActive: true }).select('_id');
    if (!hrUsers.length) return;

    const docs = hrUsers
      .filter(u => u._id.toString() !== (sender ? sender.toString() : ''))
      .map(u => ({
        recipient: u._id,
        sender,
        type,
        title,
        message,
        refId,
        refModel,
        meta,
        isRead: false,
      }));

    if (docs.length) await Notification.insertMany(docs);
  } catch (err) {
    console.error('notifyAllHR error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Send birthday notifications to all HR for a given employee
// Called by the birthday cron job
// ─────────────────────────────────────────────────────────────────────────────
const sendBirthdayNotification = async (employee) => {
  try {
    const fullName = `${employee.firstName} ${employee.lastName}`;
    await notifyAllHR({
      sender:   employee._id,
      type:     'birthday',
      title:    `🎂 Birthday Today — ${fullName}`,
      message:  `Today is ${fullName}'s birthday! Wish them a wonderful day. 🎉`,
      refId:    employee._id,
      refModel: 'User',
      meta:     { employeeId: employee.employeeId, department: employee.department },
    });
  } catch (err) {
    console.error('sendBirthdayNotification error:', err.message);
  }
};

// =============================================================================
// CONTROLLER METHODS
// =============================================================================
const notificationController = {

  // ── GET /notifications ────────────────────────────────────────────────────
  // Query: ?page=1&limit=20&unread=true&type=leave_applied
  // Employee sees only their own; HR/Admin sees all (filtered by recipient = self for bell)
  getNotifications: async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      const role   = req.user.role;

      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const skip  = (page - 1) * limit;

      const filter = {};

      // All roles see only THEIR OWN notifications (recipient = self)
      // HR gets notifications sent to them specifically (leave_applied, payslip_requested, birthday)
      // Employee gets notifications sent to them (leave_approved, leave_rejected, payslip_approved/rejected)
      filter.recipient = userId;

      if (req.query.unread === 'true') filter.isRead = false;
      if (req.query.type)              filter.type   = req.query.type;

      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter)
          .populate('sender', 'firstName lastName profilePhoto role')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Notification.countDocuments(filter),
        Notification.countDocuments({ recipient: userId, isRead: false }),
      ]);

      return res.json({
        success: true,
        notifications,
        unreadCount,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error('getNotifications error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── GET /notifications/unread-count ───────────────────────────────────────
  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      const count  = await Notification.countDocuments({ recipient: userId, isRead: false });
      return res.json({ success: true, count });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── PUT /notifications/:id/read ───────────────────────────────────────────
  markAsRead: async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      const notif  = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipient: userId },
        { isRead: true },
        { new: true }
      );
      if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
      return res.json({ success: true, notification: notif });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── PUT /notifications/mark-all-read ──────────────────────────────────────
  markAllRead: async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
      return res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── DELETE /notifications/:id ─────────────────────────────────────────────
  deleteNotification: async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      await Notification.findOneAndDelete({ _id: req.params.id, recipient: userId });
      return res.json({ success: true, message: 'Notification deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── DELETE /notifications/clear-all ──────────────────────────────────────
  clearAll: async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      await Notification.deleteMany({ recipient: userId });
      return res.json({ success: true, message: 'All notifications cleared' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = { notificationController, createNotification, notifyAllHR, sendBirthdayNotification };