const ReturnOrder = require('../models/ReturnOrder');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');

// Helper to generate Return ID (Simple auto-increment logic)
const generateReturnNumber = async () => {
  const lastReturn = await ReturnOrder.findOne().sort({ createdAt: -1 });
  if (!lastReturn) return 'RET-1001';
  
  const lastNum = parseInt(lastReturn.returnNumber.split('-')[1]);
  return `RET-${lastNum + 1}`;
};

// @desc    Create new Return Order & Restock Inventory
// @route   POST /api/returns
// @access  Private
const createReturn = async (req, res) => {
  try {
    const { invoiceId, items, reason, refundAmount } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in return order' });
    }

    // 1. Find the original invoice
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.paymentStatus === 'Draft') {
      return res.status(400).json({ message: 'Cannot process returns on a draft invoice' });
    }

    const processedItems = [];
    const bulkOption = [];

    // 2. Validate return quantities and prepare restock operations
    for (const item of items) {
      const invoiceItem = invoice.items.find(
        (i) => i.product.toString() === item.product.toString()
      );

      if (!invoiceItem) {
        return res.status(400).json({ 
          message: `Product ${item.name} not found in the original invoice` 
        });
      }

      const currentReturned = invoiceItem.returnedQuantity || 0;
      const maxRentable = invoiceItem.quantity - currentReturned;

      if (item.quantity > maxRentable) {
        return res.status(400).json({
          message: `Cannot return ${item.quantity} units of ${item.name}. Max returnable: ${maxRentable}`
        });
      }

      // Calculate Item Subtotal for return
      const itemSubtotal = item.price * item.quantity;

      processedItems.push({
        product: item.product,
        name: item.name,
        sku: invoiceItem.sku,
        quantity: item.quantity,
        price: item.price,
        subtotal: itemSubtotal
      });

      // Prepare Stock Update (Increment stock)
      bulkOption.push({
        updateOne: {
          filter: { _id: item.product },
          update: { $inc: { stock: item.quantity } },
        },
      });

      // Update returnedQuantity on original invoice item
      invoiceItem.returnedQuantity = currentReturned + item.quantity;
    }

    // 3. Update original invoice status
    let totalItemsQuantity = 0;
    let totalReturnedQuantity = 0;

    for (const invItem of invoice.items) {
      totalItemsQuantity += invItem.quantity;
      totalReturnedQuantity += (invItem.returnedQuantity || 0);
    }

    if (totalReturnedQuantity === totalItemsQuantity) {
      invoice.paymentStatus = 'Returned';
    } else if (totalReturnedQuantity > 0) {
      invoice.paymentStatus = 'Partially Returned';
    }

    // Save updated invoice
    await invoice.save();

    // 4. Update Product Stocks
    if (bulkOption.length > 0) {
      await Product.bulkWrite(bulkOption);
    }

    // 5. Create Return Order Record
    const returnNumber = await generateReturnNumber();
    const returnOrder = new ReturnOrder({
      returnNumber,
      invoice: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      items: processedItems,
      refundAmount: Number(refundAmount) || 0,
      reason: reason || '',
      creator: req.user._id,
    });

    const savedReturn = await returnOrder.save();
    res.status(201).json(savedReturn);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get All Return Orders
// @route   GET /api/returns
// @access  Private
const getReturns = async (req, res) => {
  try {
    const { returnNumber, customerName } = req.query;
    let query = {};

    if (returnNumber) {
      query.returnNumber = { $regex: returnNumber, $options: 'i' };
    }

    // If filtering by customer name, we must first find matching invoices
    if (customerName) {
      const matchingInvoices = await Invoice.find({
        customerName: { $regex: customerName, $options: 'i' }
      }).select('_id');
      
      const invoiceIds = matchingInvoices.map(inv => inv._id);
      query.invoice = { $in: invoiceIds };
    }

    const returns = await ReturnOrder.find(query)
      .populate('creator', 'name')
      .populate('invoice', 'customerName customerPhone')
      .sort({ createdAt: -1 });

    res.json(returns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Return Order Details
// @route   GET /api/returns/:id
// @access  Private
const getReturnById = async (req, res) => {
  try {
    const returnOrder = await ReturnOrder.findById(req.params.id)
      .populate('creator', 'name')
      .populate('invoice', 'customerName customerPhone subTotal discountAmount grandTotal paymentStatus');

    if (returnOrder) {
      res.json(returnOrder);
    } else {
      res.status(404).json({ message: 'Return order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createReturn,
  getReturns,
  getReturnById
};
