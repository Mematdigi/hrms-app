const mongoose = require('mongoose');

const LeaveDefaultsSchema = new mongoose.Schema({
  casualDefault: { type: Number, default: 12 }, // Casual leave per year
  sickDefault: { type: Number, default: 10 },   // Sick leave per year
}, { timestamps: true });

module.exports = mongoose.model('LeaveDefaults', LeaveDefaultsSchema);
