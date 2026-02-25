const express = require('express');
const router  = express.Router();
const {
  createHoliday,
  bulkCreateHolidays,
  getHolidays,
  getHolidayById,
  updateHoliday,
  deleteHoliday,
  checkHoliday,
  getHolidayStats,
} = require('../../controllers/holidayController');

const { uploadMiddleware } = require('../../controllers/holidayController');



// Plug in your auth middleware if needed:
// const { protect, restrictTo } = require('../middleware/authMiddleware');

// ── Stats & check (before /:id to avoid route conflicts) ──────────────────────
router.get('/stats',    getHolidayStats);   // GET  /api/holidays/stats?year=2026
router.get('/check',    checkHoliday);      // GET  /api/holidays/check?date=2026-01-01

// ── Collection routes ──────────────────────────────────────────────────────────
router.get('/',         getHolidays);       // GET  /api/holidays?year=2026&month=3
router.post('/',        createHoliday);     // POST /api/holidays
router.post('/bulk', uploadMiddleware, bulkCreateHolidays);

// ── Document routes ────────────────────────────────────────────────────────────
router.get('/:id',      getHolidayById);    // GET  /api/holidays/:id
router.put('/:id',      updateHoliday);     // PUT  /api/holidays/:id
router.delete('/:id',   deleteHoliday);     // DELETE /api/holidays/:id  (soft-delete)

module.exports = router;