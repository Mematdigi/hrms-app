const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String },
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

attendanceSchema.pre('save', async function(next) {
  if (!this.username && this.employee) {
    try {
      const User = mongoose.model('User');
      const user = await User.findById(this.employee);
      if (user) {
        this.username = `${user.firstName} ${user.lastName}`;
      }
    } catch (error) {
      console.error('Error setting username in attendance:', error);
    }
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
