# Leave Functionality Fixes - TODO List

## Issues to Fix:

### 1. Leave Model - Fix default status
- [x] Change default status from 'left' to 'pending' in server/src/models/Leave.js

### 2. Leave Controller - Fix bugs in applyLeave, approveLeave, rejectLeave
- [ ] Fix applyLeave: Proper leave balance checking using LeaveDefaults
- [ ] Fix approveLeave: Correct findById syntax and leave balance tracking
- [ ] Fix rejectLeave: Correct findById syntax

### 3. Employee Controller & Routes - Add balances endpoint
- [ ] Add getBalances function in server/src/controllers/employeeController.js
- [ ] Add /employees/:id/balances route in server/src/routes/v1/employeeRoutes.js

### 4. Frontend Leave.js - Fix leaveType mapping
- [ ] Fix leaveType values to match backend expectations (e.g., 'Casual Leave' -> 'casual')

## Progress:
- [x] Step 1: Fix Leave Model
- [ ] Step 2: Fix Leave Controller
- [ ] Step 3: Add Employee Balances Endpoint
- [ ] Step 4: Fix Frontend Leave.js
