# Role Management - Quick Setup Guide

## 🚀 Quick Start (3 Steps)

### Step 1: Restart Backend Server
```bash
cd /home/code/hrms-app
npm start
```

### Step 2: Restart Frontend
```bash
cd /home/code/hrms-app/client
npm start
```

### Step 3: Open Application
```
http://localhost:3000
```

---

## 📋 Initial Setup

### Create Test Accounts
1. Register 4 accounts:
   - **admin@test.com** → Will be admin
   - **hr@test.com** → Will be HR manager
   - **manager@test.com** → Will be manager
   - **employee@test.com** → Will be employee

### Set Roles via MongoDB (First Time Only)

Open MongoDB shell:
```bash
mongosh
use hrms
```

Set roles:
```bash
db.users.updateOne({email: "admin@test.com"}, {$set: {role: "admin"}})
db.users.updateOne({email: "hr@test.com"}, {$set: {role: "hr"}})
db.users.updateOne({email: "manager@test.com"}, {$set: {role: "manager"}})
db.users.updateOne({email: "employee@test.com"}, {$set: {role: "employee"}})
```

---

## 🎯 Using Role Management

### Access the Feature
1. Login as **admin@test.com**
2. Look for **"Roles"** link in the navbar (purple button)
3. Click it to open Role Management page

### Change a User's Role
1. Find the user in the table
2. Select new role from dropdown
3. Click **"Update"** button
4. See success message

### Verify Changes
- User's role updates immediately
- User sees new role in navbar
- New permissions take effect on next login

---

## 🔐 Role Permissions

| Feature | Admin | HR | Manager | Employee |
|---------|-------|----|---------| ---------|
| Manage Roles | ✅ | ❌ | ❌ | ❌ |
| Manage Employees | ✅ | ✅ | ❌ | ❌ |
| View Attendance | ✅ | ✅ | ✅ | ✅ |
| Approve Leave | ✅ | ✅ | ✅ | ❌ |
| View Payroll | ✅ | ✅ | ❌ | ❌ |
| View Performance | ✅ | ✅ | ✅ | ✅ |

---

## 📱 What's New in UI

### Navbar Changes
- **Admin users** see a purple "Roles" button
- **All users** see their role badge next to their name
- Example: "John Doe [ADMIN]"

### Role Management Page
- Clean table with all users
- Color-coded role badges
- Easy dropdown selection
- One-click update button

---

## ✅ Testing Checklist

- [ ] Backend server started
- [ ] Frontend server started
- [ ] Can login as admin
- [ ] See "Roles" link in navbar
- [ ] Can access Role Management page
- [ ] Can see all users in table
- [ ] Can change user roles
- [ ] See success message after update
- [ ] User role updates in table
- [ ] Other users see updated role in navbar

---

## 🐛 Troubleshooting

### "Roles" link not visible?
- Make sure you're logged in as admin
- Check browser console for errors
- Restart frontend server

### Can't update role?
- Verify you're admin
- Check MongoDB is running
- Check backend console for errors

### Changes not showing?
- Refresh the page
- Logout and login again
- Check browser cache

---

## 📞 Support

If you encounter any issues:
1. Check the browser console (F12)
2. Check backend logs
3. Verify MongoDB is running
4. Restart both servers

---

**Status**: ✅ Ready to Use!
