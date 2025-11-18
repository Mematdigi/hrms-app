const Leave = require('../models/Leave');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const Payroll = require('../models/Payroll');
const LeaveDefaults = require('../models/LeaveDefaults');

// Email configuration (you can update this with your email service)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
});
class LeaveController {
applyLeave = async (req, res) => {
  try {
    const { employeeId, leaveType, startDate, endDate, reason } = req.body;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const numberOfDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Create leave request with pending status
    const leave = new Leave({
      employee: employeeId,
      leaveType,
      startDate: start,
      endDate: end,
      numberOfDays,
      reason,
      status: 'pending'
    });

    await leave.save();

    // Populate employee details
    await leave.populate('employee', 'firstName lastName email department');

    // Find HR managers to notify
    const hrManagers = await User.find({ role: 'hr' });
    
    // Send notification emails to HR managers
    if (hrManagers.length > 0) {
      const employeeDetails = leave.employee;
      const emailList = hrManagers.map(hr => hr.email).join(', ');
      
      const mailOptions = {
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: emailList,
        subject: `New Leave Request - ${employeeDetails.firstName} ${employeeDetails.lastName}`,
        html: `
          <h2>New Leave Request for Approval</h2>
          <p><strong>Employee:</strong> ${employeeDetails.firstName} ${employeeDetails.lastName}</p>
          <p><strong>Department:</strong> ${employeeDetails.department || 'N/A'}</p>
          <p><strong>Leave Type:</strong> ${leaveType}</p>
          <p><strong>Start Date:</strong> ${start.toLocaleDateString()}</p>
          <p><strong>End Date:</strong> ${end.toLocaleDateString()}</p>
          <p><strong>Number of Days:</strong> ${numberOfDays}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p><strong>Status:</strong> <span style="color: orange; font-weight: bold;">PENDING APPROVAL</span></p>
          <p>Please log in to the HRMS system to approve or reject this request.</p>
        `
      };

      // Send email (non-blocking)
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log('Email notification error:', error);
        } else {
          console.log('Email sent to HR managers:', info.response);
        }
      });
    }

    res.status(201).json({ 
      message: 'Leave application submitted successfully. HR will review your request.',
      leave 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

getLeaveRequests = async (req, res) => {
  try {
    const { employeeId, status, role, userId } = req.query;
    const query = {};

    // If user is employee, only show their own leaves
    if (role === 'employee' && employeeId) {
      query.employee = employeeId;
    }
    // If user is HR or Manager, show all pending/approved leaves
    else if (role === 'hr' || role === 'manager') {
      if (status) {
        query.status = status;
      }
    }
    // If specific status is requested
    else if (status) {
      query.status = status;
    }

    const leaves = await Leave.find(query)
      .populate('employee', 'firstName lastName email department')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

getPendingLeaveRequests = async (req, res) => {
  try {
    // Get all pending leave requests for HR approval
    const leaves = await Leave.find({ status: 'pending' })
      .populate('employee', 'firstName lastName email department')
      .sort({ createdAt: -1 });
    
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

approveLeave = async (req, res) => {
  try {
    const { leaveId, approverId } = req.body;
    
    const leave = await Leave.findByIdAndUpdate(
      leaveId,
      {
        status: 'approved',
        approvedBy: approverId,
        approvalDate: new Date()
      },
      { new: true }
    ).populate('employee', 'firstName lastName email')
     .populate('approvedBy', 'firstName lastName');

    // Send approval email to employee
    if (leave.employee.email) {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: leave.employee.email,
        subject: 'Leave Request Approved',
        html: `
          <h2>Your Leave Request Has Been Approved</h2>
          <p>Dear ${leave.employee.firstName} ${leave.employee.lastName},</p>
          <p>Your leave request has been approved by ${leave.approvedBy.firstName} ${leave.approvedBy.lastName}.</p>
          <p><strong>Leave Details:</strong></p>
          <ul>
            <li>Leave Type: ${leave.leaveType}</li>
            <li>Start Date: ${new Date(leave.startDate).toLocaleDateString()}</li>
            <li>End Date: ${new Date(leave.endDate).toLocaleDateString()}</li>
            <li>Number of Days: ${leave.numberOfDays}</li>
          </ul>
          <p>Thank you!</p>
        `
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log('Email notification error:', error);
        } else {
          console.log('Approval email sent:', info.response);
        }
      });
    }
    
    // for update the payroll of the employee
    const payroll = await Payroll.findOne({ employee: leave.employee._id, month: new Date().getMonth() + 1, year: new Date().getFullYear() }); 
    if (payroll) {
      payroll.deductions += (payroll.baseSalary / payroll.workingDays) * leave.numberOfDays;
      payroll.netSalary = payroll.baseSalary - payroll.deductions;
      await payroll.save();
    }

    res.json({ message: 'Leave approved successfully', leave });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

rejectLeave = async (req, res) => {
  try {
    const { leaveId, rejectionReason, approverId } = req.body;
    
    const leave = await Leave.findByIdAndUpdate(
      leaveId,
      {
        status: 'rejected',
        rejectionReason,
        approvedBy: approverId,
        approvalDate: new Date()
      },
      { new: true }
    ).populate('employee', 'firstName lastName email')
     .populate('approvedBy', 'firstName lastName');

    // Send rejection email to employee
    if (leave.employee.email) {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: leave.employee.email,
        subject: 'Leave Request Rejected',
        html: `
          <h2>Your Leave Request Has Been Rejected</h2>
          <p>Dear ${leave.employee.firstName} ${leave.employee.lastName},</p>
          <p>Your leave request has been rejected by ${leave.approvedBy.firstName} ${leave.approvedBy.lastName}.</p>
          <p><strong>Rejection Reason:</strong> ${rejectionReason}</p>
          <p><strong>Leave Details:</strong></p>
          <ul>
            <li>Leave Type: ${leave.leaveType}</li>
            <li>Start Date: ${new Date(leave.startDate).toLocaleDateString()}</li>
            <li>End Date: ${new Date(leave.endDate).toLocaleDateString()}</li>
            <li>Number of Days: ${leave.numberOfDays}</li>
          </ul>
          <p>Please contact HR for more information.</p>
        `
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log('Email notification error:', error);
        } else {
          console.log('Rejection email sent:', info.response);
        }
      });
    }

    res.json({ message: 'Leave rejected successfully', leave });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

getLeaveStats = async (req, res) => {
  try {
    const stats = {
      pending: await Leave.countDocuments({ status: 'pending' }),
      approved: await Leave.countDocuments({ status: 'approved' }),
      rejected: await Leave.countDocuments({ status: 'rejected' })
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

  getDefaults = async (req, res) => {
    try {
      const defaults = await LeaveDefaults.findOne(); // Find leave defaults

      if (!defaults) {
        return res.status(404).json({ message: 'Leave defaults not found.' });
      }

      res.json(defaults); // Return default leave data
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  // --- NEW: Update Default Leaves (Casual & Sick) ---
  updateDefaults = async (req, res) => {
    try {
      const { casualDefault, sickDefault } = req.body;

      if (typeof casualDefault !== 'number' || typeof sickDefault !== 'number') {
        return res.status(400).json({ message: 'Casual and Sick leave must be numbers.' });
      }

      // Update defaults or create if none exist
      const updatedDefaults = await LeaveDefaults.findOneAndUpdate(
        {},
        { casualDefault, sickDefault },
        { new: true, upsert: true }
      );

      res.json(updatedDefaults); // Return updated leave defaults
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new LeaveController();