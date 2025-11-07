const mongoose = require('mongoose');

const performanceReviewSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewPeriod: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  strengths: { type: String },
  areasForImprovement: { type: String },
  goals: { type: String },
  comments: { type: String },
  status: { type: String, enum: ['draft', 'submitted', 'completed'], default: 'draft' },
  submittedDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PerformanceReview', performanceReviewSchema);
