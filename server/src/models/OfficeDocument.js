const mongoose = require('mongoose');

const officeDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      enum: ['HR Policy', 'Compliance', 'Finance', 'Legal', 'Operations', 'IT', 'General'],
      default: 'General',
    },
    department: {
      type: String,
      default: 'All',
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    expiryDate: {
      type: Date,
      default: null,
    },

    // File storage
    originalName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: '',
    },
    size: {
      type: Number,
      default: 0,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    downloadCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for fast searches
officeDocumentSchema.index({ title: 'text', description: 'text', tags: 'text' });
officeDocumentSchema.index({ category: 1 });
officeDocumentSchema.index({ isActive: 1 });

module.exports = mongoose.model('OfficeDocument', officeDocumentSchema);