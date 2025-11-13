const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  status: { type: String, enum: ['present', 'absent', 'half-day', 'leave'], default: 'absent' },
  workingHours: { type: Number },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
