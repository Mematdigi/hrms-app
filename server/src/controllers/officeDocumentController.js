const OfficeDocument = require('../models/OfficeDocument');
const catchAsync = require('../utils/catchAsync');
const ApiError   = require('../utils/ApiError');
const path       = require('path');
const fs         = require('fs');

const absPath = (filePath) => path.resolve(__dirname, '../../uploads', filePath);

class OfficeDocumentController {

  getAll = catchAsync(async (req, res) => {
    const { category, department, search, isActive } = req.query;
    const query = {};

    query.isActive = isActive !== undefined ? (isActive === 'true') : true;
    if (category   && category   !== 'All') query.category   = category;
    if (department && department !== 'All') query.department = { $in: [department, 'All'] };
    if (search) {
      query.$or = [
        { title:       { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags:        { $regex: search, $options: 'i' } },
      ];
    }

    const documents = await OfficeDocument.find(query)
      .populate('uploadedBy', 'firstName lastName email role')
      .sort({ createdAt: -1 }).lean();

    res.json({ success: true, data: documents, total: documents.length });
  });

  getById = catchAsync(async (req, res) => {
    const doc = await OfficeDocument.findById(req.params.id)
      .populate('uploadedBy', 'firstName lastName email role').lean();
    if (!doc) throw new ApiError(404, 'Document not found');
    res.json({ success: true, data: doc });
  });

  create = catchAsync(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'A file is required');
    const { title, description, category, department, tags, expiryDate } = req.body;
    if (!title) throw new ApiError(400, 'Title is required');

    const filePath   = req.file.path.replace(/\\/g, '/').replace(/^uploads\//, '');
    const parsedTags = tags
      ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean))
      : [];

    const newDoc = await OfficeDocument.create({
      title: title.trim(), description: description || '',
      category: category || 'General', department: department || 'All',
      tags: parsedTags, expiryDate: expiryDate || null,
      originalName: req.file.originalname, filePath,
      mimeType: req.file.mimetype, size: req.file.size,
      uploadedBy: req.user?._id || null,
    });

    await newDoc.populate('uploadedBy', 'firstName lastName email role');
    res.status(201).json({ success: true, message: 'Document uploaded successfully', data: newDoc });
  });

  update = catchAsync(async (req, res) => {
    const doc = await OfficeDocument.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Document not found');

    const { title, description, category, department, tags, expiryDate, isActive } = req.body;
    if (title)                    doc.title       = title.trim();
    if (description !== undefined) doc.description = description;
    if (category)                 doc.category    = category;
    if (department)               doc.department  = department;
    if (isActive !== undefined)   doc.isActive    = isActive === 'true' || isActive === true;
    if (expiryDate !== undefined) doc.expiryDate  = expiryDate || null;
    if (tags !== undefined) {
      doc.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    if (req.file) {
      const old = absPath(doc.filePath);
      if (fs.existsSync(old)) { try { fs.unlinkSync(old); } catch (_) {} }
      doc.filePath     = req.file.path.replace(/\\/g, '/').replace(/^uploads\//, '');
      doc.originalName = req.file.originalname;
      doc.mimeType     = req.file.mimetype;
      doc.size         = req.file.size;
    }

    await doc.save();
    await doc.populate('uploadedBy', 'firstName lastName email role');
    res.json({ success: true, message: 'Document updated successfully', data: doc });
  });

  delete = catchAsync(async (req, res) => {
    const doc = await OfficeDocument.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Document not found');
    const full = absPath(doc.filePath);
    if (fs.existsSync(full)) { try { fs.unlinkSync(full); } catch (_) {} }
    await OfficeDocument.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Document deleted successfully' });
  });

  // ── DOWNLOAD — triggers browser "Save As" dialog ──────────────────────────
  download = catchAsync(async (req, res) => {
    const doc = await OfficeDocument.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Document not found');
    const full = absPath(doc.filePath);
    if (!fs.existsSync(full)) throw new ApiError(404, 'File not found on server');

    OfficeDocument.findByIdAndUpdate(req.params.id, { $inc: { downloadCount: 1 } }).exec();

    const safeName = encodeURIComponent(doc.originalName).replace(/'/g, "%27");
    res.setHeader('Content-Disposition', `attachment; filename="${doc.originalName}"; filename*=UTF-8''${safeName}`);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', fs.statSync(full).size);
    fs.createReadStream(full).pipe(res);
  });

  // ── PREVIEW — browser renders inline (PDF / images) ──────────────────────
  preview = catchAsync(async (req, res) => {
    const doc = await OfficeDocument.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Document not found');
    const full = absPath(doc.filePath);
    if (!fs.existsSync(full)) throw new ApiError(404, 'File not found on server');

    const safeName = encodeURIComponent(doc.originalName).replace(/'/g, "%27");
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"; filename*=UTF-8''${safeName}`);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', fs.statSync(full).size);
    res.setHeader('Cache-Control', 'private, max-age=300');
    fs.createReadStream(full).pipe(res);
  });

  getStats = catchAsync(async (req, res) => {
    const [total, byCategory, recentDocs] = await Promise.all([
      OfficeDocument.countDocuments({ isActive: true }),
      OfficeDocument.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      OfficeDocument.find({ isActive: true })
        .sort({ createdAt: -1 }).limit(5)
        .select('title category createdAt originalName size').lean(),
    ]);

    res.json({ success: true, data: { total, byCategory, recentDocs } });
  });
}

module.exports = new OfficeDocumentController();