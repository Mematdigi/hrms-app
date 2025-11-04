# HRMS - Human Resource Management System

A complete MERN stack (MongoDB, Express, React, Node.js) application for managing human resources with all essential features.

## Features

### Core Modules
- **Employee Management**: Create, update, and manage employee profiles
- **Attendance & Time Tracking**: Check-in/check-out system with working hours calculation
- **Leave Management**: Apply for leaves, approve/reject requests
- **Payroll Processing**: Generate and manage employee payroll
- **Performance Reviews**: Create and track employee performance reviews
- **Dashboard**: Overview of key HR metrics

### User Roles
- **Admin**: Full system access
- **HR Manager**: Manage employees, leave, attendance, payroll
- **Manager**: View team, approve leave requests
- **Employee**: View own data, apply leave, check attendance

## Tech Stack

- **Frontend**: React 18, Redux, React Router, Axios
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Build Tools**: Webpack, Babel

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or remote connection)
- npm or yarn

## Installation & Setup

### 1. Clone/Extract the Project
```bash
cd /home/code/hrms-app
```

### 2. Backend Setup

#### Install Backend Dependencies
```bash
npm install
```

#### Configure Environment Variables
Edit `.env` file:
```
MONGODB_URI=mongodb://localhost:27017/hrms
JWT_SECRET=your_jwt_secret_key_change_this_in_production
PORT=5000
NODE_ENV=development
```

**Important**: Change `JWT_SECRET` to a strong random string in production.

#### Start MongoDB
Make sure MongoDB is running on your system:
```bash
# On Linux/Mac
mongod

# On Windows
mongod.exe
```

#### Start Backend Server
```bash
npm start
```

The backend will run on `http://localhost:5000`

### 3. Frontend Setup

#### Install Frontend Dependencies
```bash
cd client
npm install
```

#### Start Frontend Development Server
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## Running the Application

### Terminal 1 - Backend
```bash
cd /home/code/hrms-app
npm start
```

### Terminal 2 - Frontend
```bash
cd /home/code/hrms-app/client
npm start
```

Then open your browser and navigate to `http://localhost:3000`

## Default Test Credentials

### Admin Account
- Email: `admin@hrms.com`
- Password: `admin123`

### HR Account
- Email: `hr@hrms.com`
- Password: `hr123`

### Manager Account
- Email: `manager@hrms.com`
- Password: `manager123`

### Employee Account
- Email: `employee@hrms.com`
- Password: `employee123`

**Note**: You need to register these accounts first through the registration page.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile

### Employees
- `GET /api/employees` - Get all employees
- `GET /api/employees/:id` - Get employee by ID
- `POST /api/employees` - Create new employee (Admin/HR only)
- `PUT /api/employees/:id` - Update employee (Admin/HR only)
- `DELETE /api/employees/:id` - Delete employee (Admin only)

### Attendance
- `POST /api/attendance/check-in` - Check in
- `POST /api/attendance/check-out` - Check out
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance/mark` - Mark attendance (Admin/HR/Manager only)

### Leave
- `POST /api/leave/apply` - Apply for leave
- `GET /api/leave` - Get leave requests
- `POST /api/leave/approve` - Approve leave (Admin/HR/Manager only)
- `POST /api/leave/reject` - Reject leave (Admin/HR/Manager only)

### Payroll
- `POST /api/payroll/generate` - Generate payroll (Admin/HR only)
- `GET /api/payroll` - Get payroll records
- `POST /api/payroll/process` - Process payroll (Admin/HR only)
- `POST /api/payroll/pay` - Mark payroll as paid (Admin/HR only)

### Performance
- `POST /api/performance/create` - Create review (Admin/HR/Manager only)
- `GET /api/performance` - Get reviews
- `PUT /api/performance/:reviewId` - Update review (Admin/HR/Manager only)
- `POST /api/performance/submit` - Submit review (Admin/HR/Manager only)

## Project Structure

```
hrms-app/
├── server/
│   ├── config/
│   │   └── db.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Attendance.js
│   │   ├── Leave.js
│   │   ├── Payroll.js
│   │   └── PerformanceReview.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── employeeController.js
│   │   ├── attendanceController.js
│   │   ├── leaveController.js
│   │   ├── payrollController.js
│   │   └── performanceController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── employeeRoutes.js
│   │   ├── attendanceRoutes.js
│   │   ├── leaveRoutes.js
│   │   ├── payrollRoutes.js
│   │   └── performanceRoutes.js
│   ├── middleware/
│   │   └── auth.js
│   └── server.js
├── client/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   └── Navbar.js
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   ├── Dashboard.js
│   │   │   ├── Employees.js
│   │   │   ├── Attendance.js
│   │   │   ├── Leave.js
│   │   │   ├── Payroll.js
│   │   │   └── Performance.js
│   │   ├── redux/
│   │   │   ├── store.js
│   │   │   └── reducers/
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── styles/
│   │   │   ├── App.css
│   │   │   ├── Auth.css
│   │   │   ├── Navbar.css
│   │   │   ├── Dashboard.css
│   │   │   ├── Employees.css
│   │   │   ├── Attendance.css
│   │   │   ├── Leave.css
│   │   │   ├── Payroll.css
│   │   │   └── Performance.css
│   │   ├── App.js
│   │   └── index.js
│   ├── webpack.config.js
│   └── package.json
├── .env
├── package.json
└── README.md
```

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env` file
- Verify MongoDB is accessible on `localhost:27017`

### Port Already in Use
- Backend (5000): `lsof -i :5000` and kill the process
- Frontend (3000): `lsof -i :3000` and kill the process

### CORS Errors
- Ensure backend is running on `http://localhost:5000`
- Check that frontend proxy is configured correctly in webpack

### Module Not Found
- Run `npm install` in both root and client directories
- Clear node_modules and reinstall if issues persist

## Future Enhancements

- Email notifications for leave approvals
- Advanced reporting and analytics
- Mobile app support
- Document management system
- Training and development tracking
- Expense management
- Multi-language support

## License

ISC

## Support

For issues or questions, please refer to the documentation or create an issue in the repository.
