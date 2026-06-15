const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true, // E.g., INV-1001
  },
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
  },
  customerPhone: {
    type: String,
    trim: true,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      name: { type: String, required: true },
      sku: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true },
      subtotal: { type: Number, required: true },
      returnedQuantity: { type: Number, default: 0 }
    }
  ],
  subTotal: {
    type: Number,
    required: true,
  },
  // --- CHANGED: Removed Tax, Added Discount ---
  discountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  grandTotal: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Cancelled', 'Draft', 'Returned', 'Partially Returned'],
    default: 'Paid',
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'Online', 'Other'],
    default: 'Cash',
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);