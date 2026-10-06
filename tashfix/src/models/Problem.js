const mongoose = require('mongoose');
const { DISTRICT_CODES } = require('../config/districts');
const { TYPE_CODES } = require('../config/problemTypes');

const problemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TYPE_CODES, required: true },
    title: { type: String, default: '' },
    description: { type: String, required: true, maxlength: 500 },
    district: { type: String, enum: DISTRICT_CODES, required: true, index: true },
    address: { type: String, required: true, maxlength: 200 },
    photoFileId: { type: String, default: null },
    reporterTelegramId: { type: Number, required: true, index: true },
    reporterName: { type: String, default: '' },
    confirmedBy: { type: [Number], default: [], index: true },
    status: {
      type: String,
      enum: ['new', 'review', 'in_progress', 'resolved'],
      default: 'new',
    },
    statusHistory: [
      {
        _id: false,
        status: String,
        note: { type: String, default: '' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

problemSchema.index({ district: 1, status: 1 });

module.exports = mongoose.model('Problem', problemSchema);
