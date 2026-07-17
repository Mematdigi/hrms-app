const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  role: { type: String, enum: ['admin', 'hr', 'manager', 'tl', 'employee'], default: 'employee' },
  department: { type: String },
  designation: { type: String },
  employeeId: { type: String, unique: true },
  dateOfJoining: { type: Date },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  zipCode: { type: String },
  profileImage: { type: String },
  reportingManager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ── Company Hierarchy (added) ────────────────────────────────────────────
  // Each employee can be assigned to exactly one Team Lead (Employee → TL → Manager → HR/Admin).
  teamLead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Ordered tier for org-chart rendering:
  // 1 = Admin/Founder, 2 = HR/Manager, 3 = Team Lead, 4 = Senior Employee, 5 = Employee/Intern
  designationLevel: { type: Number, min: 1, max: 5, default: 5 },
  // ─────────────────────────────────────────────────────────────────────────
  baseSalary:{type:Number},
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  // Keep updatedAt fresh on every save (was previously never updated — bug fix)
  this.updatedAt = new Date();
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
