const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
  },
  sku: {
    type: String,
    required: [true, 'Please add a SKU/Barcode'],
    unique: true,
    trim: true,
    uppercase: true,
  },
  description: {
    type: String,
    required: false,
  },
  costPrice: {
    type: Number,
    required: false,
    default: 0,
  },
  // --- CHANGED: Selling Price is now OPTIONAL ---
  sellingPrice: {
    type: Number,
    required: false, // <--- No longer required
    default: 0,      // Default to 0 if not provided
    min: 0,
  },
  stock: {
    type: Number,
    required: [true, 'Please add initial stock quantity'],
    default: 0,
  },
  image: {
    url: { type: String, default: '' },
    public_id: { type: String, default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);