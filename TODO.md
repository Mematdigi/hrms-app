# TODO: Add API Data in UserProfile Page

## Task: Add API data in userprofile page

## Plan:

### Step 1: Add profile route to server
- [ ] Edit `server/src/routes/v1/authRoutes.js` to add `/profile` GET route with authMiddleware

### Step 2: Update client UserProfile.js to fetch and display API data
- [ ] Import authAPI from services/api.js
- [ ] Add useState for user, loading, and error states
- [ ] Add useEffect to fetch profile on component mount
- [ ] Replace hardcoded values with user data from API:
  - Profile header: name, designation, employee ID, department, employment type
  - Personal details tab: email, phone, address, city, state, zipCode
  - Work details tab: employeeId, department, designation, dateOfJoining, reportingManager
- [ ] Handle loading and error states

## Notes:
- The User model doesn't have emergency contact fields - those will remain as placeholder or can be added to the model
- Documents tab will remain with placeholder/hardcoded data as it would require additional endpoints
