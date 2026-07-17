const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const routesV1 = require('./routes/v1');
const morganConfig = require('./config/morgan');
const statusCodes = require('http-status');
const ApiError = require('./utils/ApiError');
const { errorConverter, errorHandler } = require('./middleware/error');
const morgan = require('morgan');
const startAttendanceStatusCron = require('./jobs/schedulars');
const startBirthdayCron = require('./jobs/Birthdaycron'); // ✅ Birthday cron
const startScoringCron = require('./jobs/scoringJob'); // 🧮 Scoring engine cron

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
// app.use('/uploads', express.static('uploads'));
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

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
  app.use(express.static(path.join(__dirname, '../../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
  });
}

// 404 handler
app.use((req, res, next) => {
  next(new ApiError(404, statusCodes[statusCodes.NOT_FOUND], 'Route not found'));
});

app.use(errorConverter);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Mode: ${process.env.NODE_ENV}`);

  // ✅ Start cron jobs
  // startAttendanceStatusCron(); // Uncomment if needed
  startBirthdayCron(); // 🎂 Birthday notifications daily at 10 AM IST
  startScoringCron();  // 🧮 Nightly score recompute + month-end Employee-of-the-Month lock
});