# Quick Start Guide

## One-Time Setup

### 1. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Start MongoDB

Make sure MongoDB is running:
```bash
mongod
```

### 3. Configure Environment

The `.env` file is already configured. For production, update:
```
JWT_SECRET=your_strong_secret_key
```

## Running the Application

### Option 1: Run in Separate Terminals (Recommended for Development)

**Terminal 1 - Backend:**
```bash
cd /home/code/hrms-app
npm start
```

**Terminal 2 - Frontend:**
```bash
cd /home/code/hrms-app/client
npm start
```

Then open: `http://localhost:3000`

### Option 2: Run Backend Only (for API testing)

```bash
npm start
```

API will be available at: `http://localhost:5000/api`

## First Time Usage

1. Go to `http://localhost:3000`
2. Click "Register here" to create an account
3. Fill in your details and register
4. Login with your credentials
5. Start using the HRMS system

## Test Accounts (After Registration)

Create these accounts for testing different roles:

**Admin:**
- Email: admin@hrms.com
- Password: admin123
- Role: admin

**HR Manager:**
- Email: hr@hrms.com
- Password: hr123
- Role: hr

**Manager:**
- Email: manager@hrms.com
- Password: manager123
- Role: manager

**Employee:**
- Email: employee@hrms.com
- Password: employee123
- Role: employee

## Common Issues

### MongoDB Connection Failed
```bash
# Check if MongoDB is running
mongod

# Or use MongoDB Atlas (cloud)
# Update MONGODB_URI in .env to your Atlas connection string
```

### Port Already in Use
```bash
# Kill process on port 5000 (backend)
lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Dependencies Not Installing
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

cd client
rm -rf node_modules package-lock.json
npm install
cd ..
```

## Features to Try

1. **Dashboard**: View HR metrics
2. **Employees**: Add and manage employees
3. **Attendance**: Check-in/check-out
4. **Leave**: Apply for and manage leaves
5. **Payroll**: Generate and view payroll
6. **Performance**: Create performance reviews

## Next Steps

- Read the full README.md for detailed documentation
- Explore the API endpoints
- Customize the styling in `client/src/styles/`
- Add more features as needed

Happy coding! 🚀
