const mongoose = require('mongoose');

const assetOtherSchema = new mongoose.Schema({
  label:   { type: String, required: true },
  checked: { type: Boolean, default: false }
}, { _id: true });

const offboardingSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },

  // ── Action Type ───────────────────────────────────────────────────────────
  actionType: {
    type: String,
    enum: ['voluntary', 'involuntary'],
    required: true
  },

  // ── Involuntary Reason (only for involuntary) ─────────────────────────────
  involuntaryReason: {
    type: String,
    enum: [
      'Misconduct', 'Behavior', 'Abscond', 'Unethical',
      'Layoff', 'Separation', 'BGC', 'Infosec breach', 'Others', ''
    ],
    default: ''
  },
  involuntaryReasonOther: {
    type: String,
    default: ''
  },

  // ── Assets ────────────────────────────────────────────────────────────────
  assets: {
    laptop:  { type: Boolean, default: false },
    mouse:   { type: Boolean, default: false },
    charger: { type: Boolean, default: false },
    others:  { type: [assetOtherSchema], default: [] }
  },

  // ── Notice Period ─────────────────────────────────────────────────────────
  noticePeriod: {
    type: String,
    enum: ['Yes', 'No', 'Not Applicable'],
    default: 'Not Applicable'
  },

  // ── Full & Final (FNF) ────────────────────────────────────────────────────
  fnf: {
    ral:     { type: String, enum: ['Yes', 'No', 'Not Applicable'], default: 'Not Applicable' },
    rl:      { type: String, enum: ['Yes', 'No', 'Not Applicable'], default: 'Not Applicable' },
    payslip: { type: String, enum: ['Yes', 'No', 'Not Applicable'], default: 'Not Applicable' }
  },

  // ── Remarks ───────────────────────────────────────────────────────────────
  remarks: {
    type: String,
    default: ''
  },

  // ── Status ────────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },

  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Offboarding', offboardingSchema);