const express = require('express');
const router = express.Router();
const { 
  createInvoice, 
  getInvoices, 
  getInvoiceById,
  updateInvoice
} = require('../controllers/invoiceController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .post(protect, createInvoice)  // Create & Deduct Stock
  .get(protect, getInvoices);    // View History

router.route('/:id')
  .get(protect, getInvoiceById)  // View Single Invoice for Printing
  .put(protect, updateInvoice);  // Update / Cancel Invoice

module.exports = router;