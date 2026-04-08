const PersonalDocument = require('../models/PersonalDocument');
const catchAsync = require('../utils/catchAsync');
const ApiError   = require('../utils/ApiError');
const mongoose   = require('mongoose');
const path       = require('path');
const fs         = require('fs');

const absPath = (filePath) =>
  path.resolve(__dirname, '../../uploads', filePath);

// ── Resolve user ID from JWT payload ─────────────────────────────────────────
// Auth middleware may attach req.user._id (ObjectId) OR req.user.id (string).
const getUserId = (req) => {
  const raw = req.user?._id || req.user?.id;
  if (!raw) return null;
  try { return new mongoose.Types.ObjectId(raw.toString()); } catch { return raw; }
};

// ── Ownership: owner OR admin/HR ─────────────────────────────────────────────
const isOwnerOrAdmin = (doc, req) => {
  const userId = getUserId(req);
  if (!userId) return false;
  if (['admin', 'hr'].includes(req.user?.role)) return true;
  return doc.uploadedBy.toString() === userId.toString();
};

class PersonalDocumentController {

  getMyDocuments = catchAsync(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) throw new ApiError(401, 'Not authenticated');

    const { search, category } = req.query;
    const isAdminOrHR = ['admin', 'hr'].includes(req.user?.role);

    const targetId = (isAdminOrHR && req.query.userId) ? req.query.userId : userId;
    const query = { uploadedBy: targetId };

    if (category && category !== 'All') query.category = category;
    if (search) {
      query.$or = [
        { title:       { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const docs = await PersonalDocument.find(query).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: docs, total: docs.length });
  });

  getById = catchAsync(async (req, res) => {
    const doc = await PersonalDocument.findById(req.params.id).lean();
    if (!doc) throw new ApiError(404, 'Document not found');
    if (!isOwnerOrAdmin(doc, req)) throw new ApiError(403, 'Access denied');
    res.json({ success: true, data: doc });
  });

  create = catchAsync(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) throw new ApiError(401, 'Not authenticated');
    if (!req.file) throw new ApiError(400, 'A file is required');

    const { title, description, category } = req.body;
    if (!title || !title.trim()) throw new ApiError(400, 'Title is required');

    const filePath = req.file.path.replace(/\\/g, '/').replace(/^uploads\//, '');

    const doc = await PersonalDocument.create({
      title:        title.trim(),
      description:  description || '',
      category:     category    || 'Other',
      originalName: req.file.originalname,
      filePath,
      mimeType:     req.file.mimetype,
      size:         req.file.size,
      uploadedBy:   userId,
    });

    res.status(201).json({ success: true, message: 'Personal document uploaded', data: doc });
  });

  update = catchAsync(async (req, res) => {
    const doc = await PersonalDocument.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Document not found');
    if (!isOwnerOrAdmin(doc, req)) throw new ApiError(403, 'Access denied');

    const { title, description, category } = req.body;
    if (title)                     doc.title       = title.trim();
    if (description !== undefined)  doc.description = description;
    if (category)                  doc.category    = category;

    if (req.file) {
      const old = absPath(doc.filePath);
      if (fs.existsSync(old)) { try { fs.unlinkSync(old); } catch (_) {} }
      doc.filePath     = req.file.path.replace(/\\/g, '/').replace(/^uploads\//, '');
      doc.originalName = req.file.originalname;
      doc.mimeType     = req.file.mimetype;
      doc.size         = req.file.size;
    }

    await doc.save();
    res.json({ success: true, message: 'Document updated', data: doc });
  });

  delete = catchAsync(async (req, res) => {
    const doc = await PersonalDocument.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Document not found');
    if (!isOwnerOrAdmin(doc, req)) throw new ApiError(403, 'Access denied');

    const full = absPath(doc.filePath);
    if (fs.existsSync(full)) { try { fs.unlinkSync(full); } catch (_) {} }

    await PersonalDocument.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Document deleted' });
  });

  download = catchAsync(async (req, res) => {
    const doc = await PersonalDocument.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Document not found');
    if (!isOwnerOrAdmin(doc, req)) throw new ApiError(403, 'Access denied');

    const full = absPath(doc.filePath);
    if (!fs.existsSync(full)) throw new ApiError(404, 'File not found on server');

    PersonalDocument.findByIdAndUpdate(req.params.id, { $inc: { downloadCount: 1 } }).exec();

    const safeName = encodeURIComponent(doc.originalName).replace(/'/g, "%27");
    res.setHeader('Content-Disposition', `attachment; filename="${doc.originalName}"; filename*=UTF-8''${safeName}`);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', fs.statSync(full).size);
    fs.createReadStream(full).pipe(res);
  });

  preview = catchAsync(async (req, res) => {
    const doc = await PersonalDocument.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Document not found');
    if (!isOwnerOrAdmin(doc, req)) throw new ApiError(403, 'Access denied');

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
    const userId = getUserId(req);
    if (!userId) throw new ApiError(401, 'Not authenticated');

    const objId = new mongoose.Types.ObjectId(userId.toString());

    const [total, byCategory] = await Promise.all([
      PersonalDocument.countDocuments({ uploadedBy: objId }),
      PersonalDocument.aggregate([
        { $match: { uploadedBy: objId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),
    ]);

    res.json({ success: true, data: { total, byCategory } });
  });
}

module.exports = new PersonalDocumentController();