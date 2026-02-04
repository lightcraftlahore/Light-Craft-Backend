const Invoice = require('../models/Invoice');
const Product = require('../models/Product');

// Helper to generate Invoice ID (Simple auto-increment logic)
const generateInvoiceNumber = async () => {
  const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
  if (!lastInvoice) return 'INV-1001';
  
  const lastNum = parseInt(lastInvoice.invoiceNumber.split('-')[1]);
  return `INV-${lastNum + 1}`;
};

// @desc    Create new Invoice & Update Stock
// @route   POST /api/invoices
// @access  Private
const createInvoice = async (req, res) => {
  try {
    // --- CHANGED: Extract discountAmount instead of taxRate ---
    const { customerName, customerPhone, items, discountAmount, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in invoice' });
    }

    // 1. Validate Stock & Calculate Totals
    let calculatedSubTotal = 0;
    const bulkOption = [];
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.name}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}` 
        });
      }

      // Calculate Item Subtotal
      const itemSubtotal = item.price * item.quantity;
      calculatedSubTotal += itemSubtotal;

      // Add to processed items array
      processedItems.push({
        product: item.product,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: itemSubtotal
      });

      // Prepare Stock Update Operation
      bulkOption.push({
        updateOne: {
          filter: { _id: item.product },
          update: { $inc: { stock: -item.quantity } },
        },
      });
    }

    // --- CHANGED: Calculate Grand Total (Subtotal - Discount) ---
    // Ensure discount is a valid number
    const validDiscount = Number(discountAmount) || 0;
    
    // Safety check: Don't allow discount to make total negative
    if (validDiscount > calculatedSubTotal) {
      return res.status(400).json({ message: 'Discount cannot be greater than the total amount' });
    }

    const grandTotal = calculatedSubTotal - validDiscount;

    // 3. Create Invoice Record
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = new Invoice({
      invoiceNumber,
      customerName,
      customerPhone,
      items: processedItems,
      subTotal: calculatedSubTotal,
      discountAmount: validDiscount, // --- CHANGED ---
      grandTotal,
      paymentMethod,
      creator: req.user._id,
    });

    const savedInvoice = await invoice.save();

    // 4. Execute Stock Updates
    await Product.bulkWrite(bulkOption);

    res.status(201).json(savedInvoice);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get All Invoices (History with Filters)
// @route   GET /api/invoices
// @access  Private
const getInvoices = async (req, res) => {
  try {
    const { startDate, endDate, customerName } = req.query;
    let query = {};

    // Date Filter
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Customer Name Filter
    if (customerName) {
      query.customerName = { $regex: customerName, $options: 'i' };
    }

    const invoices = await Invoice.find(query)
      .populate('creator', 'name')
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Invoice Details (For Print Preview)
// @route   GET /api/invoices/:id
// @access  Private
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('items.product', 'sku description')
      .populate('creator', 'name');

    if (invoice) {
      res.json(invoice);
    } else {
      res.status(404).json({ message: 'Invoice not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createInvoice, getInvoices, getInvoiceById };