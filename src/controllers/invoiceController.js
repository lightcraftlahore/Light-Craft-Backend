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
    // --- CHANGED: Extract paymentStatus alongside other fields ---
    const { customerName, customerPhone, items, discountAmount, paymentMethod, paymentStatus } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in invoice' });
    }

    // 1. Validate Stock & Calculate Totals
    let calculatedSubTotal = 0;
    const bulkOption = [];
    const processedItems = [];
    const isDraft = paymentStatus === 'Draft';

    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.name}` });
      }

      // Skip stock verification for draft invoices
      if (!isDraft && product.stock < item.quantity) {
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
        sku: product.sku,
        quantity: item.quantity,
        price: item.price,
        subtotal: itemSubtotal
      });

      // Prepare Stock Update Operation only if NOT a draft
      if (!isDraft) {
        bulkOption.push({
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { stock: -item.quantity } },
          },
        });
      }
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
      paymentStatus: paymentStatus || 'Paid',
      creator: req.user._id,
    });

    const savedInvoice = await invoice.save();

    // 4. Execute Stock Updates (Skip if draft)
    if (!isDraft && bulkOption.length > 0) {
      await Product.bulkWrite(bulkOption);
    }

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

// @desc    Update Invoice (Update Draft, Finalize Draft, or Cancel Finalized)
// @route   PUT /api/invoices/:id
// @access  Private
const updateInvoice = async (req, res) => {
  try {
    const { customerName, customerPhone, items, discountAmount, paymentMethod, paymentStatus } = req.body;
    
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const oldStatus = invoice.paymentStatus;
    const newStatus = paymentStatus || oldStatus;

    // SCENARIO 1: Cancel a Finalized Invoice (Paid/Pending/Partially Returned -> Cancelled)
    if (newStatus === 'Cancelled' && oldStatus !== 'Cancelled' && oldStatus !== 'Draft') {
      // Restore stock for all products on this invoice (excluding already returned items!)
      const bulkOption = [];
      for (const item of invoice.items) {
        // Calculate items currently in customer hands (original quantity - already returned quantity)
        const quantityToRestore = item.quantity - (item.returnedQuantity || 0);
        if (quantityToRestore > 0) {
          bulkOption.push({
            updateOne: {
              filter: { _id: item.product },
              update: { $inc: { stock: quantityToRestore } },
            },
          });
        }
      }

      if (bulkOption.length > 0) {
        await Product.bulkWrite(bulkOption);
      }

      invoice.paymentStatus = 'Cancelled';
      const updatedInvoice = await invoice.save();
      return res.json(updatedInvoice);
    }

    // SCENARIO 2: Editing a Draft (can keep as Draft or transition to Paid/Pending)
    if (oldStatus === 'Draft') {
      if (!items || items.length === 0) {
        return res.status(400).json({ message: 'No items in invoice' });
      }

      const isFinalizing = newStatus === 'Paid' || newStatus === 'Pending';
      let calculatedSubTotal = 0;
      const bulkOption = [];
      const processedItems = [];

      for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product) {
          return res.status(404).json({ message: `Product not found: ${item.name}` });
        }

        if (isFinalizing && product.stock < item.quantity) {
          return res.status(400).json({
            message: `Insufficient stock for ${product.name}. Available: ${product.stock}`
          });
        }

        const itemSubtotal = item.price * item.quantity;
        calculatedSubTotal += itemSubtotal;

        processedItems.push({
          product: item.product,
          name: item.name,
          sku: product.sku,
          quantity: item.quantity,
          price: item.price,
          subtotal: itemSubtotal,
          returnedQuantity: 0
        });

        if (isFinalizing) {
          bulkOption.push({
            updateOne: {
              filter: { _id: item.product },
              update: { $inc: { stock: -item.quantity } },
            },
          });
        }
      }

      const validDiscount = Number(discountAmount) || 0;
      if (validDiscount > calculatedSubTotal) {
        return res.status(400).json({ message: 'Discount cannot be greater than the total amount' });
      }

      const grandTotal = calculatedSubTotal - validDiscount;

      // Update invoice fields
      invoice.customerName = customerName || invoice.customerName;
      invoice.customerPhone = customerPhone !== undefined ? customerPhone : invoice.customerPhone;
      invoice.items = processedItems;
      invoice.subTotal = calculatedSubTotal;
      invoice.discountAmount = validDiscount;
      invoice.grandTotal = grandTotal;
      invoice.paymentMethod = paymentMethod || invoice.paymentMethod;
      invoice.paymentStatus = newStatus;

      const updatedInvoice = await invoice.save();

      // Deduct stock if finalizing
      if (isFinalizing && bulkOption.length > 0) {
        await Product.bulkWrite(bulkOption);
      }

      return res.json(updatedInvoice);
    }

    // SCENARIO 3: Non-draft invoice editing
    if (oldStatus !== 'Draft') {
      if (items && items.length > 0) {
        // 1. Temporarily restore old items stock
        const restoreOption = [];
        for (const item of invoice.items) {
          const quantityToRestore = item.quantity - (item.returnedQuantity || 0);
          if (quantityToRestore > 0) {
            restoreOption.push({
              updateOne: {
                filter: { _id: item.product },
                update: { $inc: { stock: quantityToRestore } },
              },
            });
          }
        }
        if (restoreOption.length > 0) {
          await Product.bulkWrite(restoreOption);
        }

        // 2. Validate new items and calculate totals
        let calculatedSubTotal = 0;
        const deductOption = [];
        const processedItems = [];
        let hasStockError = false;
        let stockErrorMessage = '';

        for (const item of items) {
          const product = await Product.findById(item.product);
          if (!product) {
            hasStockError = true;
            stockErrorMessage = `Product not found: ${item.name}`;
            break;
          }

          if (product.stock < item.quantity) {
            hasStockError = true;
            stockErrorMessage = `Insufficient stock for ${product.name}. Available after restoration: ${product.stock}`;
            break;
          }

          const itemSubtotal = item.price * item.quantity;
          calculatedSubTotal += itemSubtotal;

          const originalItem = invoice.items.find(
            (i) => i.product.toString() === item.product.toString()
          );
          const originalReturned = originalItem ? originalItem.returnedQuantity : 0;

          processedItems.push({
            product: item.product,
            name: item.name,
            sku: product.sku,
            quantity: item.quantity,
            price: item.price,
            subtotal: itemSubtotal,
            returnedQuantity: originalReturned
          });

          deductOption.push({
            updateOne: {
              filter: { _id: item.product },
              update: { $inc: { stock: -item.quantity } },
            },
          });
        }

        // 3. Rollback if stock error
        if (hasStockError) {
          const rollbackOption = [];
          for (const item of invoice.items) {
            const quantityToReDeduct = item.quantity - (item.returnedQuantity || 0);
            if (quantityToReDeduct > 0) {
              rollbackOption.push({
                updateOne: {
                  filter: { _id: item.product },
                  update: { $inc: { stock: -quantityToReDeduct } },
                },
              });
            }
          }
          if (rollbackOption.length > 0) {
            await Product.bulkWrite(rollbackOption);
          }
          return res.status(400).json({ message: stockErrorMessage });
        }

        const validDiscount = Number(discountAmount) || 0;
        if (validDiscount > calculatedSubTotal) {
          const rollbackOption = [];
          for (const item of invoice.items) {
            const quantityToReDeduct = item.quantity - (item.returnedQuantity || 0);
            if (quantityToReDeduct > 0) {
              rollbackOption.push({
                updateOne: {
                  filter: { _id: item.product },
                  update: { $inc: { stock: -quantityToReDeduct } },
                },
              });
            }
          }
          if (rollbackOption.length > 0) {
            await Product.bulkWrite(rollbackOption);
          }
          return res.status(400).json({ message: 'Discount cannot be greater than the total amount' });
        }

        const grandTotal = calculatedSubTotal - validDiscount;

        // Execute stock deduction for new items
        if (deductOption.length > 0) {
          await Product.bulkWrite(deductOption);
        }

        invoice.customerName = customerName || invoice.customerName;
        invoice.customerPhone = customerPhone !== undefined ? customerPhone : invoice.customerPhone;
        invoice.items = processedItems;
        invoice.subTotal = calculatedSubTotal;
        invoice.discountAmount = validDiscount;
        invoice.grandTotal = grandTotal;
        invoice.paymentMethod = paymentMethod || invoice.paymentMethod;
        invoice.paymentStatus = newStatus;

        const updatedInvoice = await invoice.save();
        return res.json(updatedInvoice);
      } else {
        // No items updated, just update fields
        invoice.customerName = customerName || invoice.customerName;
        invoice.customerPhone = customerPhone !== undefined ? customerPhone : invoice.customerPhone;
        invoice.paymentMethod = paymentMethod || invoice.paymentMethod;
        invoice.paymentStatus = newStatus;

        const updatedInvoice = await invoice.save();
        return res.json(updatedInvoice);
      }
    }

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createInvoice, getInvoices, getInvoiceById, updateInvoice };