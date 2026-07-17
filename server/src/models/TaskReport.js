const mongoose = require('mongoose');

/**
 * TaskReport — created and owned by a TEAM LEAD, not the employee.
 *
 * The TL selects one of their team members, a start/end date range (typically a
 * week), the number of tasks assigned, and how many of those were completed.
 * The employee can only VIEW this report — they never fill it in.
 *
 * This is the sole data source for the Task bucket (50 pts) of the
 * Employee/Intern of the Month score:
 *   +50 baseline for the month
 *   −2 per incomplete task  (incompleteTasks = totalTasks − completedTasks)
 *   −1 per working day in the month not covered by any TL task report
 */
const taskReportSchema = new mongoose.Schema({
  // The TL who created this report
  teamLead:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teamLeadName: { type: String },

  // The team member the report is about
  employee:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeName: { type: String },

  // Reporting window (usually a week, but any range is allowed)
  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },

  totalTasks:     { type: Number, required: true, min: 0 },
  completedTasks: { type: Number, required: true, min: 0 },

  // Derived on save — never trust the client for this
  incompleteTasks: { type: Number, default: 0, min: 0 },
  completionRate:  { type: Number, default: 0, min: 0, max: 100 }, // %

  remarks: { type: String, default: '' },
}, { timestamps: true });

taskReportSchema.index({ employee: 1, startDate: 1, endDate: 1 });
taskReportSchema.index({ teamLead: 1, startDate: -1 });

taskReportSchema.pre('save', function (next) {
  // Completed can never exceed total
  if (this.completedTasks > this.totalTasks) this.completedTasks = this.totalTasks;

  this.incompleteTasks = Math.max(0, this.totalTasks - this.completedTasks);
  this.completionRate = this.totalTasks > 0
    ? Math.round((this.completedTasks / this.totalTasks) * 100)
    : 0;
  next();
});

module.exports = mongoose.model('TaskReport', taskReportSchema);
