const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    default: 'My Company',
  },
  companyAddress: {
    type: String,
    required: true,
    default: '123 Business St, City',
  },
  companyPhone: {
    type: String,
    required: true,
    default: '000-000-0000',
  },
  taxRate: {
    type: Number,
    required: true,
    default: 0, // Default 0%
  },
  currencySymbol: {
    type: String,
    default: '$',
  },
  logo: {
    url: { type: String, default: '' },
    public_id: { type: String, default: '' },
  }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);