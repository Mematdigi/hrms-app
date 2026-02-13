# Leave Section Fixes - TODO List

## Backend Fixes:
- [ ] 1. Fix syntax error in leaveController.js - `}else(leaveType === 'sick')` should be `} else if (leaveType === 'sick')`
- [ ] 2. Fix duplicate code in approveLeave function in leaveController.js
- [ ] 3. Fix status default value in Leave model - change from 'left' to 'pending'
- [ ] 4. Add balances endpoint in employee routes (employeeRoutes.js)
- [ ] 5. Add getBalances function in employeeController.js

## Frontend Fixes:
- [ ] 6. Fix leave type values in Leave.js - change from 'Casual Leave'/'Sick Leave' to 'casual'/'sick'
- [ ] 7. Update api.js to call the correct balances endpoint

## Testing:
- [ ] 8. Test backend API endpoints
- [ ] 9. Test frontend leave section
- [ ] 10. Fix any remaining issues
