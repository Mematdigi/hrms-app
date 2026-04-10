// models/Resignation.js

const mongoose = require('mongoose');

const resignationSchema = new mongoose.Schema(
  {
    // The employee who submitted the resignation
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    // Denormalised for quick display (avoids populate overhead in lists)
    employeeName: { type: String, required: true },
    employeeId:   { type: String, required: true }, // e.g. "EMP001"

    // Manager / TL name — entered manually by the employee
    managerName: { type: String, required: true, trim: true },

    // Reason the employee writes
    resignationReason: { type: String, required: true, trim: true },

    // Workflow status
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },

    // HR fills these in on rejection
    rejectionReason: { type: String, default: '' },

    // Which HR / admin acted on it
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    reviewedAt: { type: Date, default: null },

    // Allow the employee to withdraw and re-apply
    // (set to true once rejected so they can submit again)
    canReapply: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resignation', resignationSchema);