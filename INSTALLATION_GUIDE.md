# HRMS Application - Complete Installation Guide

## System Requirements

- **Node.js**: v14 or higher
- **MongoDB**: v4.4 or higher (local or cloud)
- **npm**: v6 or higher
- **RAM**: Minimum 2GB
- **Disk Space**: Minimum 500MB

## Step-by-Step Installation

### Step 1: Verify Node.js and npm Installation

```bash
node --version
npm --version
```

Both should show version numbers. If not, install Node.js from https://nodejs.org/

### Step 2: Verify MongoDB Installation

```bash
mongod --version
```

If MongoDB is not installed:
- **Linux**: `sudo apt-get install mongodb`
- **Mac**: `brew install mongodb-community`
- **Windows**: Download from https://www.mongodb.com/try/download/community

### Step 3: Navigate to Project Directory

```bash
cd /home/code/hrms-app
```

### Step 4: Install Backend Dependencies

```bash
npm install
```

This will install:
- express (web framework)
- mongoose (MongoDB ODM)
- bcryptjs (password hashing)
- jsonwebtoken (JWT authentication)
- cors (cross-origin requests)
- dotenv (environment variables)
- multer (file uploads)
- nodemailer (email notifications)

### Step 5: Install Frontend Dependencies

```bash
cd client
npm install
cd ..
```

This will install:
- react (UI library)
- react-dom (React DOM)
- react-router-dom (routing)
- axios (HTTP client)
- redux (state management)
- react-redux (Redux bindings)
- webpack (bundler)
- babel (transpiler)

### Step 6: Verify Environment Configuration

Check `.env` file:
```bash
cat .env
```

Should contain:
```
MONGODB_URI=mongodb://localhost:27017/hrms
JWT_SECRET=your_jwt_secret_key_change_this_in_production
PORT=5000
NODE_ENV=development
```

## Running the Application

### Option A: Development Mode (Recommended)

**Terminal 1 - Start MongoDB:**
```bash
mongod
```

**Terminal 2 - Start Backend:**
```bash
cd /home/code/hrms-app
npm start
```

Expected output:
```
Server running on port 5000
MongoDB Connected: localhost
```

**Terminal 3 - Start Frontend:**
```bash
cd /home/code/hrms-app/client
npm start
```

Expected output:
```
webpack 5.75.0 compiled successfully
```

Then open: `http://localhost:3000`

### Option B: Production Build

```bash
# Build frontend
cd client
npm run build
cd ..

# Start backend (serves built frontend)
npm start
```

## First Time Setup

### 1. Create Admin Account

1. Open `http://localhost:3000`
2. Click "Register here"
3. Fill in details:
   - First Name: Admin
   - Last Name: User
   - Email: admin@hrms.com
   - Password: admin123
4. Click Register
5. You'll be logged in automatically

### 2. Create Test Accounts

Repeat the registration process for:

**HR Manager:**
- Email: hr@hrms.com
- Password: hr123

**Manager:**
- Email: manager@hrms.com
- Password: manager123

**Employee:**
- Email: employee@hrms.com
- Password: employee123

### 3. Update User Roles (via MongoDB)

Connect to MongoDB and update roles:

```bash
mongosh
use hrms
db.users.updateOne({email: "admin@hrms.com"}, {$set: {role: "admin"}})
db.users.updateOne({email: "hr@hrms.com"}, {$set: {role: "hr"}})
db.users.updateOne({email: "manager@hrms.com"}, {$set: {role: "manager"}})
db.users.updateOne({email: "employee@hrms.com"}, {$set: {role: "employee"}})
```

## Verification Checklist

- [ ] Node.js installed (v14+)
- [ ] MongoDB installed and running
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] .env file configured
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can access http://localhost:3000
- [ ] Can register new account
- [ ] Can login successfully
- [ ] Dashboard loads correctly

## Common Issues & Solutions

### Issue: "MongoDB connection failed"
**Solution:**
```bash
# Start MongoDB
mongod

# Or use MongoDB Atlas (cloud)
# Update MONGODB_URI in .env to your connection string
```

### Issue: "Port 5000 already in use"
**Solution:**
```bash
# Find and kill process on port 5000
lsof -i :5000
kill -9 <PID>

# Or use different port
# Edit .env: PORT=5001
```

### Issue: "Port 3000 already in use"
**Solution:**
```bash
# Find and kill process on port 3000
lsof -i :3000
kill -9 <PID>

# Or use different port in webpack.config.js
```

### Issue: "npm ERR! code ERESOLVE"
**Solution:**
```bash
npm install --legacy-peer-deps
```

### Issue: "Cannot find module"
**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# For frontend
cd client
rm -rf node_modules package-lock.json
npm install
cd ..
```

### Issue: "CORS error"
**Solution:**
- Ensure backend is running on http://localhost:5000
- Check webpack proxy configuration
- Verify API calls use correct base URL

### Issue: "Webpack compilation error"
**Solution:**
```bash
# Clear webpack cache
rm -rf client/dist
npm start
```

## Database Setup

### Local MongoDB

```bash
# Start MongoDB
mongod

# Connect to MongoDB shell
mongosh

# Create database
use hrms

# Verify connection
db.version()
```

### MongoDB Atlas (Cloud)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create cluster
4. Get connection string
5. Update MONGODB_URI in .env:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hrms
```

## Performance Optimization

### Backend
- Use connection pooling
- Add database indexes
- Implement caching
- Use pagination for large datasets

### Frontend
- Enable code splitting
- Optimize images
- Use lazy loading
- Minify CSS/JS

## Security Checklist

- [ ] Change JWT_SECRET to strong random string
- [ ] Use HTTPS in production
- [ ] Implement rate limiting
- [ ] Add input validation
- [ ] Use environment variables for secrets
- [ ] Enable CORS only for trusted domains
- [ ] Hash passwords (already implemented)
- [ ] Validate user permissions

## Deployment Preparation

### Before Deploying

1. Update JWT_SECRET
2. Set NODE_ENV=production
3. Use MongoDB Atlas or managed database
4. Enable HTTPS
5. Set up environment variables
6. Test all features
7. Backup database

### Deployment Platforms

- **Heroku**: Easy deployment with free tier
- **AWS**: Scalable cloud platform
- **DigitalOcean**: Affordable VPS
- **Vercel**: Frontend hosting
- **MongoDB Atlas**: Cloud database

## Maintenance

### Regular Tasks

- Monitor server logs
- Backup database regularly
- Update dependencies
- Review security logs
- Monitor performance metrics

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update packages
npm update

# Update to latest major version
npm install package@latest
```

## Support & Resources

- **Documentation**: See README.md
- **Quick Start**: See QUICKSTART.md
- **API Docs**: See README.md API section
- **MongoDB Docs**: https://docs.mongodb.com/
- **Express Docs**: https://expressjs.com/
- **React Docs**: https://react.dev/

## Next Steps

1. Complete installation following this guide
2. Verify all systems are working
3. Create test accounts
4. Explore all features
5. Customize as needed
6. Deploy to production

## Troubleshooting Help

If you encounter issues:

1. Check error messages carefully
2. Review logs in terminal
3. Verify all prerequisites are installed
4. Check .env configuration
5. Ensure MongoDB is running
6. Clear cache and reinstall dependencies
7. Restart all services

Good luck! 🚀
