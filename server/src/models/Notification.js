// src/models/Notification.js
const mongoose = require('mongoose');

/**
 * Notification — stores in-app notifications for users.
 *
 * Types:
 *   leave_applied     → HR ko milegi jab employee leave apply kare
 *   leave_approved    → Employee ko milegi jab HR approve kare
 *   leave_rejected    → Employee ko milegi jab HR reject kare
 *   payslip_requested → HR ko milegi jab employee payslip download request kare
 *   payslip_approved  → Employee ko milegi jab HR approve kare
 *   payslip_rejected  → Employee ko milegi jab HR reject kare
 *   birthday          → HR ko milegi employee ke birthday pe
 *   general           → Any other notification
 */
const notificationSchema = new mongoose.Schema(
  {
    // Who this notification belongs to (recipient)
    recipient: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    // Who triggered this notification (sender/actor) — optional
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
      default: null,
    },

    // Notification type
    type: {
      type: String,
      enum: [
        'leave_applied',
        'leave_approved',
        'leave_rejected',
        'payslip_requested',
        'payslip_approved',
        'payslip_rejected',
        'birthday',
        'general',
      ],
      required: true,
    },

    // Display content
    title:   { type: String, required: true },
    message: { type: String, required: true },

    // Read status
    isRead: { type: Boolean, default: false, index: true },

    // Reference to the related document (Leave._id, Payroll._id, etc.)
    refId:    { type: mongoose.Schema.Types.ObjectId, default: null },
    refModel: {
      type:    String,
      enum:    ['Leave', 'Payroll', 'User', null],
      default: null,
    },

    // Extra data (optional — store anything extra)
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true, // createdAt, updatedAt auto manage honge
  }
);

// ── Indexes for fast queries ──────────────────────────────────────────────────
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);