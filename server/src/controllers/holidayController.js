const Holiday = require('../models/Holiday.modal');
const multer = require('multer');
const xlsx   = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });
// ─── Helper: parse Indian date string "1st January 2026" → JS Date (UTC midnight) ──
const parseIndianDate = (str) => {
  const cleaned = str.replace(/(\d+)(st|nd|rd|th)/, '$1');
  const d = new Date(cleaned + ' UTC');
  if (isNaN(d)) throw new Error(`Cannot parse date:w "${str}"`);
  return d;
};

// ─── Helper: expand "8th November 2026 - 11th November 2026" into array of Dates ──
const expandDates = (rawDate) => {
  if (rawDate.includes(' - ')) {
    const [startStr, endStr] = rawDate.split(' - ').map(s => s.trim());
    const start = parseIndianDate(startStr);
    const end   = parseIndianDate(endStr);
    const dates = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }
  return [parseIndianDate(rawDate)];
};

// ─── Helper: get Set of "YYYY-MM-DD" strings for a given year+month (used by payroll) ──
const getHolidaySet = async (year, month) => {
  const holidays = await Holiday.find({ year, month, isActive: true }).select('date');
  return new Set(holidays.map(h => h.date.toISOString().slice(0, 10)));
};

// ═════════════════════════════════════════════════════════════════════════════
class HolidayController {

  // ───────────────────────────────────────────────────────────────────────────
  // CREATE HOLIDAY
  // POST /api/holidays
  // Body: { name, date, description }
  // Range dates ("8th Nov 2026 - 11th Nov 2026") are auto-expanded per day
  // ───────────────────────────────────────────────────────────────────────────
  createHoliday = async (req, res) => {
    try {
      const { name, date, description } = req.body;

      if (!name || !date) {
        return res.status(400).json({ message: '`name` and `date` are required.' });
      }

      const dates = expandDates(date);
      const docs  = dates.map(d => ({
        name,
        date:        d,
        year:        d.getUTCFullYear(),
        month:       d.getUTCMonth() + 1,
        description: description || ''
      }));

      const result = await Holiday.insertMany(docs, { ordered: false });

      return res.status(201).json({
        message:  `${result.length} holiday date(s) created successfully.`,
        holidays: result
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'One or more dates already exist as holidays.' });
      }
      console.error('createHoliday error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // BULK CREATE HOLIDAYS  (seed entire calendar at once)
  // POST /api/holidays/bulk
  // Body: { holidays: [{ name, date, description }, ...] }
  // ───────────────────────────────────────────────────────────────────────────
  // ─── ADD this at the top of holidayController.js (with other requires) ────────
// const multer = require('multer');
// const xlsx   = require('xlsx');
//
// const upload = multer({ storage: multer.memoryStorage() });
// module.exports.uploadMiddleware = upload.single('file');   ← wire this in routes

  // ───────────────────────────────────────────────────────────────────────────
  // BULK CREATE HOLIDAYS — accepts .xlsx file upload
  // POST /api/holidays/bulk
  // Form-data: file = <Holiday_Calendar_2026.xlsx>
  //
  // Expected Excel columns (case-insensitive):
  //   #  |  Holiday Name  |  Date  |  Day
  // ───────────────────────────────────────────────────────────────────────────
  bulkCreateHolidays = async (req, res) => {
    try {
      // ── 1. Validate file was uploaded ──────────────────────────────────────
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded. Send the Excel file as form-data with key `file`.' });
      }

      const ext = req.file.originalname.split('.').pop().toLowerCase();
      if (!['xlsx', 'xls'].includes(ext)) {
        return res.status(400).json({ message: 'Only .xlsx or .xls files are supported.' });
      }

      // ── 2. Parse Excel from buffer ─────────────────────────────────────────
      const workbook  = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet     = workbook.Sheets[sheetName];

      // Convert to array-of-arrays to handle merged cells / custom headers
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

      // ── 3. Find header row (the row containing "Holiday Name") ────────────
      let headerRowIdx = -1;
      let nameCol      = -1;
      let dateCol      = -1;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i].map(cell => (cell ? String(cell).trim().toLowerCase() : ''));
        const ni  = row.findIndex(c => c.includes('holiday name') || c === 'name');
        const di  = row.findIndex(c => c === 'date');
        if (ni !== -1 && di !== -1) {
          headerRowIdx = i;
          nameCol      = ni;
          dateCol      = di;
          break;
        }
      }

      if (headerRowIdx === -1) {
        return res.status(422).json({
          message: 'Could not find header row. Excel must have columns: "Holiday Name" and "Date".'
        });
      }

      // ── 4. Extract holiday rows (skip header + any note/empty rows) ────────
      const dataRows = rows.slice(headerRowIdx + 1);
      const docs     = [];
      const skipped  = [];

      for (const row of dataRows) {
        const rawName = row[nameCol] ? String(row[nameCol]).trim() : '';
        const rawDate = row[dateCol] ? String(row[dateCol]).trim() : '';

        // Skip empty rows and note rows (e.g. "Note: Diwali…")
        if (!rawName || !rawDate)               { skipped.push({ rawName, rawDate, reason: 'empty' });  continue; }
        if (rawName.toLowerCase().startsWith('note:')) { skipped.push({ rawName, reason: 'note row' }); continue; }

        // Expand date ranges into individual docs
        try {
          expandDates(rawDate).forEach(d => docs.push({
            name:  rawName,
            date:  d,
            year:  d.getUTCFullYear(),
            month: d.getUTCMonth() + 1,
            description: ''
          }));
        } catch (parseErr) {
          skipped.push({ rawName, rawDate, reason: parseErr.message });
        }
      }

      if (docs.length === 0) {
        return res.status(422).json({
          message: 'No valid holiday entries could be parsed from the file.',
          skipped
        });
      }

      // ── 5. Insert — ordered:false so partial success is allowed ───────────
      let result  = [];
      let dupCount = 0;

      try {
        result = await Holiday.insertMany(docs, { ordered: false });
      } catch (bulkErr) {
        // Mongoose bulk write error — some inserted, some were duplicates
        if (bulkErr.code === 11000 || bulkErr.name === 'MongoBulkWriteError') {
          result   = bulkErr.insertedDocs || [];
          dupCount = docs.length - result.length;
        } else {
          throw bulkErr;
        }
      }

      return res.status(201).json({
        message:  `${result.length} holiday date(s) created successfully.${dupCount > 0 ? ` ${dupCount} duplicate(s) skipped.` : ''}`,
        inserted: result.length,
        duplicates: dupCount,
        skippedRows: skipped.length,
        holidays: result
      });

    } catch (error) {
      console.error('bulkCreateHolidays error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GET ALL HOLIDAYS
  // GET /api/holidays?year=2026&month=3&isActive=true
  // ───────────────────────────────────────────────────────────────────────────
  getHolidays = async (req, res) => {
    try {
      const filter = {};
      if (req.query.year)             filter.year     = Number(req.query.year);
      if (req.query.month)            filter.month    = Number(req.query.month);
      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive !== 'false';
      }

      const holidays = await Holiday.find(filter).sort({ date: 1 }).lean();

      return res.json({ count: holidays.length, holidays });
    } catch (error) {
      console.error('getHolidays error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GET HOLIDAY BY ID
  // GET /api/holidays/:id
  // ───────────────────────────────────────────────────────────────────────────
  getHolidayById = async (req, res) => {
    try {
      const holiday = await Holiday.findById(req.params.id).lean();

      if (!holiday) return res.status(404).json({ message: 'Holiday not found.' });

      return res.json(holiday);
    } catch (error) {
      console.error('getHolidayById error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // UPDATE HOLIDAY
  // PUT /api/holidays/:id
  // Body: any subset of { name, date, description, isActive }
  // ───────────────────────────────────────────────────────────────────────────
  updateHoliday = async (req, res) => {
    try {
      const { name, date, description, isActive } = req.body;
      const update = {};

      if (name        !== undefined) update.name        = name;
      if (description !== undefined) update.description = description;
      if (isActive    !== undefined) update.isActive    = isActive;

      if (date !== undefined) {
        const dates = expandDates(date);
        if (dates.length > 1) {
          return res.status(400).json({
            message: 'Cannot update a single record to a date range. Delete and use bulk create instead.'
          });
        }
        update.date  = dates[0];
        update.year  = dates[0].getUTCFullYear();
        update.month = dates[0].getUTCMonth() + 1;
      }

      update.updatedAt = new Date();

      const holiday = await Holiday.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true, runValidators: true }
      );

      if (!holiday) return res.status(404).json({ message: 'Holiday not found.' });

      return res.json({ message: 'Holiday updated successfully.', holiday });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'Another holiday already exists on that date.' });
      }
      console.error('updateHoliday error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE HOLIDAY  (soft-delete — sets isActive: false)
  // DELETE /api/holidays/:id
  // ───────────────────────────────────────────────────────────────────────────
  deleteHoliday = async (req, res) => {
    try {
      const holiday = await Holiday.findByIdAndUpdate(
        req.params.id,
        { $set: { isActive: false, updatedAt: new Date() } },
        { new: true }
      );

      if (!holiday) return res.status(404).json({ message: 'Holiday not found.' });

      return res.json({ message: 'Holiday deactivated successfully.', holiday });
    } catch (error) {
      console.error('deleteHoliday error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // CHECK IF DATE IS A HOLIDAY
  // GET /api/holidays/check?date=2026-01-01
  // ───────────────────────────────────────────────────────────────────────────
  checkHoliday = async (req, res) => {
    try {
      if (!req.query.date) {
        return res.status(400).json({ message: '`date` query param is required (YYYY-MM-DD).' });
      }

      const d       = new Date(req.query.date + 'T00:00:00.000Z');
      const holiday = await Holiday.findOne({ date: d, isActive: true }).lean();

      return res.json({
        isHoliday: !!holiday,
        holiday:   holiday || null
      });
    } catch (error) {
      console.error('checkHoliday error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // GET HOLIDAY STATS  (for HR dashboard)
  // GET /api/holidays/stats?year=2026
  // ───────────────────────────────────────────────────────────────────────────
  getHolidayStats = async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();

      const [total, active] = await Promise.all([
        Holiday.countDocuments({ year }),
        Holiday.countDocuments({ year, isActive: true })
      ]);

      return res.json({ year, total, active, inactive: total - active });
    } catch (error) {
      console.error('getHolidayStats error:', error);
      return res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new HolidayController();

// ─── Named helper — imported directly by payrollController ───────────────────
const holidayController = new HolidayController();
module.exports                    = holidayController;
module.exports.getHolidaySet      = getHolidaySet;
module.exports.uploadMiddleware   = upload.single('file');