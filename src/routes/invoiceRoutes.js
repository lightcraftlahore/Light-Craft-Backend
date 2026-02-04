const express = require('express');
const router = express.Router();
const { 
  createInvoice, 
  getInvoices, 
  getInvoiceById 
} = require('../controllers/invoiceController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .post(protect, createInvoice)  // Create & Deduct Stock
  .get(protect, getInvoices);    // View History

router.route('/:id')
  .get(protect, getInvoiceById); // View Single Invoice for Printing

module.exports = router;