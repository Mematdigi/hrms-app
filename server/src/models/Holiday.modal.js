const mongoose = require('mongoose');

/**
 * Holiday — stores individual holiday dates.
 * Range holidays (like Diwali) are expanded into individual day entries.
 */
const holidaySchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: true,
      trim:     true
    },
    date: {
      type:     Date,
      required: true,
      unique:   true   // one doc per calendar date
    },
    year: {
      type:     Number,
      required: true,
      index:    true
    },
    month: {
      type:     Number,   // 1–12
      required: true
    },
    description: {
      type:    String,
      default: ''
    },
    isActive: {
      type:    Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for quick "is this date a holiday?" lookups
holidaySchema.index({ date: 1, isActive: 1 });
holidaySchema.index({ year: 1, month: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);