const Invoice = require('../models/Invoice');
const Product = require('../models/Product');

// @desc    Get Dashboard Statistics (Sales, Low Stock, Recent Activity)
// @route   GET /api/dashboard
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    // 1. Define "Today" (Start of day to End of day)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 2. Aggregate Sales Data (The Professional Way)
    // We use MongoDB Aggregation to sum values directly in the DB
    const salesStats = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay }, // Filter for Today
          paymentStatus: 'Paid' // Only count paid invoices
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' }, // Sum of grandTotal
          invoiceCount: { $sum: 1 }            // Count of invoices
        }
      }
    ]);

    // 3. Aggregate Total Items Sold Today
    // Since items are an array inside invoices, we need to 'unwind' them first
    const itemStats = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          paymentStatus: 'Paid'
        }
      },
      { $unwind: '$items' }, // Deconstruct items array
      {
        $group: {
          _id: null,
          totalItemsSold: { $sum: '$items.quantity' }
        }
      }
    ]);

    // 4. Get Low Stock Alerts (Stock <= 5)
    const lowStockThreshold = 5;
    const lowStockProducts = await Product.find({ stock: { $lte: lowStockThreshold } })
      .select('name sku stock image') // Only get necessary fields
      .limit(5); // Show top 5 critical items

    // 5. Get Recent Activity (Last 5 Invoices)
    const recentInvoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('creator', 'name')
      .select('invoiceNumber customerName grandTotal createdAt');

    // 6. Format Response
    res.json({
      totalSalesToday: salesStats.length > 0 ? salesStats[0].totalSales : 0,
      totalInvoicesToday: salesStats.length > 0 ? salesStats[0].invoiceCount : 0,
      totalItemsSold: itemStats.length > 0 ? itemStats[0].totalItemsSold : 0,
      lowStockAlerts: lowStockProducts,
      recentActivity: recentInvoices
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error fetching dashboard stats' });
  }
};

module.exports = { getDashboardStats };