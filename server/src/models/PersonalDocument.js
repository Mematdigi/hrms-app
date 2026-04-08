const mongoose = require('mongoose');

const personalDocumentSchema = new mongoose.Schema(
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
      enum: ['Identity', 'Education', 'Experience', 'Financial', 'Medical', 'Legal', 'Other'],
      default: 'Other',
    },

    // File storage
    originalName: { type: String, required: true },
    filePath:     { type: String, required: true },
    mimeType:     { type: String, default: ''    },
    size:         { type: Number, default: 0     },

    // Strictly owned by one user — never returned to others
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index: fast per-user queries
personalDocumentSchema.index({ uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.model('PersonalDocument', personalDocumentSchema);