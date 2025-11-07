const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const routesV1 = require('./routes/v1');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
// app.use('/api/auth', require('./routes/v1/authRoutes'));
// app.use('/api/employees', require('./routes/v1/employeeRoutes'));
// app.use('/api/attendance', require('./routes/v1/attendanceRoutes'));
// app.use('/api/leave', require('./routes/v1/leaveRoutes'));
// app.use('/api/payroll', require('./routes/v1/payrollRoutes'));
// app.use('/api/performance', require('./routes/v1/performanceRoutes'));
// app.use('/api/roles', require('./routes/v1/roleRoutes'));

app.use("/v1", routesV1);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
