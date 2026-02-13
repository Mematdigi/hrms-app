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

    const remaningLeaves = await Leave.findOne({ employee: employeeId }).sort({ createdAt: -1 });

    if (leaveType === 'casual' && remaningLeaves && remaningLeaves.employee.casualLeave < numberOfDays) {
      return res.status(400).json({ message: 'Insufficient casual leave balance.' });
    }
    if (leaveType === 'sick' && remaningLeaves && remaningLeaves.employee.sickLeave < numberOfDays) {
      return res.status(400).json({ message: 'Insufficient sick leave balance.' });
    }

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
    // HR / Manager / Admin → filter by status if provided
    else if (role === 'hr' || role === 'manager' || role === 'admin') {
      if (status) {
        query.status = status;
      }
       
         else {
    query.status = { $ne: "left" }; // otherwise exclude left
      }
    }
    // If specific status is requested for others
    else if (status) {
      query.status = status;
    }

    // 1️⃣ Main leaves list (with employee details)
    const leaves = await Leave.find(query)
      .populate({
        path: 'employee',
        select:
          'firstName lastName email department designation dateOfJoining employeeId',
      })
      .populate({
        path: 'approvedBy',
        select: 'firstName lastName',
      })
      .sort({ createdAt: -1 })
      .lean(); // <-- so we can easily attach custom fields

    // If no leaves, just return empty as before
    if (!leaves || leaves.length === 0) {
      return res.json([]);
    }

    // 2️⃣ Unique employee IDs from these leaves
    const employeeIds = [
      ...new Set(
        leaves
          .map((l) => l.employee && l.employee._id && l.employee._id.toString())
          .filter(Boolean)
      ),
    ];

    // 3️⃣ Fetch full leave history for these employees
    const allLeavesForEmployees = await Leave.find({
      employee: { $in: employeeIds },
      // status: { $in: [''pending', 'approved', 'rejected'] }, // only past leaves
    })
      .sort({ createdAt: -1 })
      .lean();

    // 4️⃣ Group history by employeeId
    const historyMap = {};
    allLeavesForEmployees.forEach((lv) => {
      const empId = lv.employee.toString();
      if (!historyMap[empId]) historyMap[empId] = [];
      historyMap[empId].push(lv);
    });

    // 5️⃣ Attach employeeLeaveHistory to each leave entry
    const enrichedLeaves = leaves.map((l) => {
      const empId =
        l.employee && l.employee._id && l.employee._id.toString();
      return {
        ...l,
        employeeLeaveHistory: empId ? historyMap[empId] || [] : [],
      };
    });

    // 🔁 Response still an array (same style as before)
    return res.json(enrichedLeaves);
  } catch (error) {
    console.error('Error in getLeaveRequests:', error);
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
    const { leaveId, approverId, leaveType, numberOfDays } = req.body;

    const leave = await Leave.findById(
      leaveId,
      // {
      //   status: 'approved',
      //   approvedBy: approverId,
      //   approvalDate: new Date()
      // },
      { new: true }
    ).populate('employee casualLeave sickLeave status reason', 'firstName lastName email employeeId')

    console.log("leave",leave);
    leave.status = 'approved';
    leave.approvedBy = approverId;
    leave.approvalDate = new Date();
    leave.numberOfDays = numberOfDays;

    if (leaveType === 'casual'){
      leave.casualLeave = (leave.casualLeave || 0) - numberOfDays;
    }else
    {
      leave.sickLeave = (leave.sickLeave || 0) - numberOfDays;
    }

    leave.status = 'approved';
    leave.approvedBy = approverId;
    leave.approvalDate = new Date();
    leave.numberOfDays = numberOfDays;
        // console.log("leave after",leave);

    const updateLeave = await Leave.findByIdAndUpdate(leave._id, leave, { new: true });
     
    if(!updateLeave){
      return res.status(404).json({ message: 'Leave  not updated' });
    }
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
    const { leaveId,leaveType,numberOfDays,rejectionReason, approverId } = req.body;

     const leave = await Leave.findById(
      leaveId,
      { new: true }
    ).populate('employee casualLeave sickLeave status reason', 'firstName lastName email employeeId')

    if(leave.status !== "rejected"){
    if (leaveType === 'casual'){
      leave.casualLeave = (leave.casualLeave || 0) + numberOfDays;
    } else if (leaveType === 'sick') {
      leave.sickLeave = (leave.sickLeave || 0) + numberOfDays;
    }
    }
    
        leave.status = 'rejected',
       leave.approvedBy= approverId,
      leave.approvalDate= new Date()
    

    const updateLeave = await Leave.findByIdAndUpdate(leave._id, leave, { new: true });

    if(!updateLeave){
      return res.status(404).json({ message: 'Leave  not updated' });
    }
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