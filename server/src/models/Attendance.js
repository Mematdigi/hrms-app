const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  checkInLocation: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  checkOutLocation: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  status: { 
    type: String, 
    enum: ['present', 'absent', 'half-day', 'leave', 'working', 'pending-approval'], 
    default: 'absent' 
  },
  workingHours: { type: Number },
  notes: { type: String },
  earlyCheckoutRequest: {
    requested: { type: Boolean, default: false },
    reason: { type: String },
    requestedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedAt: { type: Date }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);