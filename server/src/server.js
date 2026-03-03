const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path'); // ✅ ADD THIS
const connectDB = require('./config/db');
const routesV1 = require('./routes/v1');
const morganConfig = require('./config/morgan');
const statusCodes = require('http-status');
const ApiError = require('./utils/ApiError');
const { errorConverter, errorHandler } = require('./middleware/error');
const morgan = require('morgan');
const basePath = '/Hrms-app';
const startAttendanceStatusCron = require('./jobs/schedulars')

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

app.use(morganConfig.successHandler);
app.use(morganConfig.errorHandler);

// Connect to MongoDB
connectDB();

// ── API Routes ──
app.use("/v1", routesV1);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

// ✅ Serve React Frontend in Production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from client/build
  app.use(express.static(path.join(__dirname, '../../client/build')));

  // All non-API routes → serve React index.html (for React Router)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
  });
}

// 404 handler (only for API routes in production)
app.use((req, res, next) => {
  next(new ApiError(404, statusCodes[statusCodes.NOT_FOUND], 'Route not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Mode: ${process.env.NODE_ENV}`);
});

// startAttendanceStatusCron()