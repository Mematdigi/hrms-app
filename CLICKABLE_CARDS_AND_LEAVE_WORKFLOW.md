# Clickable Dashboard Cards & HR Leave Approval Workflow

## Overview

This document describes the two major enhancements made to the HRMS application:

1. **Clickable Dashboard Cards** - All dashboard cards and feature items are now clickable and navigate to relevant pages
2. **HR Leave Approval Workflow** - Leave requests from employees are now routed to HR for approval with email notifications

---

## Feature 1: Clickable Dashboard Cards

### What Changed

#### Dashboard.js Updates
- All dashboard cards are now clickable with `onClick` handlers
- Feature items are also clickable for navigation
- Added `handleCardClick()` function to manage navigation
- Cards show a visual indicator (arrow) on hover
- Smooth transitions and animations on interaction

#### Dashboard.css Updates
- Added `.clickable-card` class with cursor pointer
- Added hover effects with animated arrow indicator
- Added `.clickable-feature` class for feature items
- Smooth scale animations on click
- Responsive design maintained

### Navigation Routes

**Admin Dashboard Cards:**
- Total Employees → `/employees`
- Active Employees → `/attendance`
- Departments → `/leave`
- System Settings → `/settings`

**HR Manager Dashboard Cards:**
- Total Employees → `/employees`
- Leave Requests → `/leave`
- Payroll → `/payroll`

**Manager Dashboard Cards:**
- Team Members → `/team`
- Leave Requests → `/leave`
- Attendance → `/attendance`
- My Profile → `/profile`

**Employee Dashboard Cards:**
- My Profile → `/profile`
- Leave Management → `/leave`
- Attendance → `/attendance`
- Payroll → `/payroll`

### Visual Indicators

- **Cursor Change**: Pointer cursor on hover
- **Arrow Animation**: Right arrow (→) appears on hover
- **Scale Effect**: Cards scale down slightly on click
- **Smooth Transitions**: All animations use 0.3s ease timing

### Code Example

```javascript
const handleCardClick = (action) => {
  const routes = {
    'employees': '/employees',
    'attendance': '/attendance',
    'leave': '/leave',
    'payroll': '/payroll',
    'roles': '/roles',
    'reports': '/reports',
    'settings': '/settings',
    'team': '/team',
    'profile': '/profile',
  };
  
  if (routes[action]) {
    navigate(routes[action]);
  }
};

// Usage in card
<div className="dashboard-card admin-card clickable-card" 
     onClick={() => handleCardClick('employees')}>
  {/* Card content */}
</div>
```

---

## Feature 2: HR Leave Approval Workflow

### What Changed

#### Backend Changes

**Leave Model** (No changes - already had approval fields)
- `status`: pending, approved, rejected
- `approvedBy`: Reference to approving HR user
- `approvalDate`: Date of approval/rejection
- `rejectionReason`: Reason if rejected

**Leave Controller** (`leaveController.js`)
- `applyLeave()`: Now sends email notifications to HR managers
- `getPendingLeaveRequests()`: New endpoint to get pending requests
- `approveLeave()`: Sends approval email to employee
- `rejectLeave()`: Sends rejection email to employee
- `getLeaveStats()`: New endpoint for leave statistics

**Leave Routes** (`leaveRoutes.js`)
- `POST /leave/apply` - Apply for leave
- `GET /leave/requests` - Get leave requests (role-based)
- `GET /leave/pending` - Get pending requests (HR only)
- `GET /leave/stats` - Get leave statistics
- `PUT /leave/approve` - Approve leave (HR only)
- `PUT /leave/reject` - Reject leave (HR only)

#### Frontend Changes

**Leave.js** (Complete rewrite)
- Employee view: Apply leave form + my leave requests
- HR view: Pending requests (card view) + all requests (table view)
- Tab-based interface for HR
- Success/error message alerts
- Real-time updates after approval/rejection

**Leave.css** (Complete rewrite)
- Professional card-based design for pending requests
- Responsive table layout for all requests
- Color-coded status badges
- Action buttons for approve/reject
- Alert styling for success/error messages
- Mobile-responsive design

**API Service** (`api.js`)
- `leaveAPI.getPending()` - Get pending requests
- `leaveAPI.getStats()` - Get leave statistics
- Updated `approve()` and `reject()` to use PUT method

### Workflow Steps

#### Employee Perspective

1. **Apply for Leave**
   - Click "Apply Leave" button on dashboard
   - Fill in leave type, dates, and reason
   - Submit request
   - ✅ Success message: "Leave request submitted successfully! HR will review your request."
   - 📧 HR receives email notification

2. **Track Request**
   - View "My Leave Requests" table
   - See status: Pending, Approved, or Rejected
   - If rejected, see rejection reason

#### HR Manager Perspective

1. **Receive Notification**
   - 📧 Email notification when employee applies for leave
   - Email includes: Employee name, department, leave type, dates, reason

2. **Review Pending Requests**
   - Click "Pending Requests" tab
   - View requests in card format
   - See employee details and leave information

3. **Approve or Reject**
   - Click "✅ Approve" button to approve
   - Click "❌ Reject" button to reject (prompts for reason)
   - 📧 Employee receives email notification

4. **View All Requests**
   - Click "All Requests" tab
   - See all leave requests in table format
   - Filter by status if needed

### Email Notifications

#### Leave Application Email (to HR)
```
Subject: New Leave Request - [Employee Name]

Employee: [First Name] [Last Name]
Department: [Department]
Leave Type: [Type]
Start Date: [Date]
End Date: [Date]
Number of Days: [Days]
Reason: [Reason]
Status: PENDING APPROVAL

Please log in to the HRMS system to approve or reject this request.
```

#### Approval Email (to Employee)
```
Subject: Leave Request Approved

Dear [Employee Name],

Your leave request has been approved by [HR Manager Name].

Leave Details:
- Leave Type: [Type]
- Start Date: [Date]
- End Date: [Date]
- Number of Days: [Days]

Thank you!
```

#### Rejection Email (to Employee)
```
Subject: Leave Request Rejected

Dear [Employee Name],

Your leave request has been rejected by [HR Manager Name].

Rejection Reason: [Reason]

Leave Details:
- Leave Type: [Type]
- Start Date: [Date]
- End Date: [Date]
- Number of Days: [Days]

Please contact HR for more information.
```

### Email Configuration

To enable email notifications, set these environment variables in `.env`:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

**Note**: For Gmail, use an App Password, not your regular password.

### Status Badges

- **⏳ Pending**: Yellow badge - Awaiting HR approval
- **✅ Approved**: Green badge - Approved by HR
- **❌ Rejected**: Red badge - Rejected by HR

### Role-Based Access

**Employee:**
- Can apply for leave
- Can view own leave requests
- Cannot approve/reject leaves

**HR Manager:**
- Can view all leave requests
- Can approve pending requests
- Can reject pending requests
- Receives email notifications
- Can view leave statistics

**Manager:**
- Can view team leave requests
- Can approve/reject team member leaves
- Cannot view other teams' leaves

**Admin:**
- Full access to all leave management features
- Can view all requests
- Can approve/reject any request

---

## Files Modified

### Backend
- `/server/controllers/leaveController.js` - Updated with approval workflow
- `/server/routes/leaveRoutes.js` - Added new endpoints
- `/server/models/Leave.js` - No changes (already had required fields)

### Frontend
- `/client/src/pages/Dashboard.js` - Added clickable cards
- `/client/src/pages/Leave.js` - Complete rewrite with HR workflow
- `/client/src/styles/Dashboard.css` - Added clickable card styling
- `/client/src/styles/Leave.css` - Complete rewrite
- `/client/src/services/api.js` - Added new API endpoints

---

## Testing the Features

### Test Clickable Cards

1. Start the application
2. Login as any user
3. Go to Dashboard
4. Hover over any card - arrow should appear
5. Click on card - should navigate to relevant page
6. Click on feature items - should also navigate

### Test Leave Workflow

1. **Employee Apply for Leave:**
   - Login as employee
   - Go to Leave page
   - Click "Apply Leave"
   - Fill in form and submit
   - See success message
   - Check email (if configured)

2. **HR Approve Leave:**
   - Login as HR manager
   - Go to Leave page
   - Click "Pending Requests" tab
   - See pending requests in card format
   - Click "✅ Approve" button
   - See success message
   - Employee receives approval email

3. **HR Reject Leave:**
   - Login as HR manager
   - Go to Leave page
   - Click "Pending Requests" tab
   - Click "❌ Reject" button
   - Enter rejection reason
   - See success message
   - Employee receives rejection email

---

## Troubleshooting

### Cards Not Clickable
- Check that `useNavigate` hook is imported from `react-router-dom`
- Verify routes are defined in your router configuration
- Check browser console for errors

### Leave Requests Not Showing
- Verify user is logged in
- Check that leave requests exist in database
- Check API endpoints are working (use browser DevTools)

### Email Notifications Not Sending
- Verify `EMAIL_USER` and `EMAIL_PASSWORD` are set in `.env`
- Check that email service is configured correctly
- For Gmail, use App Password instead of regular password
- Check server logs for email errors

### HR Not Seeing Pending Requests
- Verify user role is set to 'hr' in database
- Check that leave requests have status 'pending'
- Verify API endpoint `/leave/pending` is working

---

## Future Enhancements

1. **Email Template Customization**
   - Allow custom email templates
   - Support for HTML email formatting

2. **Leave Balance Tracking**
   - Track leave balance per employee
   - Prevent applying for leave if balance is insufficient

3. **Approval Chain**
   - Support multi-level approval (Manager → HR → Admin)
   - Configurable approval workflow

4. **Leave Calendar**
   - Visual calendar showing approved leaves
   - Team leave calendar view

5. **Notifications**
   - In-app notifications for leave status changes
   - SMS notifications option

6. **Leave Reports**
   - Generate leave reports by department
   - Leave utilization analytics

---

## Summary

These enhancements significantly improve the user experience:

✅ **Clickable Cards**: Intuitive navigation from dashboard
✅ **Leave Workflow**: Proper approval process with notifications
✅ **Email Notifications**: Automatic communication with stakeholders
✅ **Role-Based Access**: Different views for different roles
✅ **Responsive Design**: Works on all devices
✅ **Professional UI**: Modern, clean interface

The application is now more user-friendly and follows proper HR workflows!
