const Setting = require('../models/Setting');
const cloudinary = require('../config/cloudinary');

// @desc    Get Company Settings (Logo, Tax, Address)
// @route   GET /api/settings
// @access  Private (Available to all users to display on invoices)
const getSettings = async (req, res) => {
  try {
    // Return the first settings document, or create default if none exists
    let settings = await Setting.findOne();
    
    if (!settings) {
      settings = await Setting.create({}); // Create with defaults
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update Company Settings
// @route   PUT /api/settings
// @access  Private (Super Admin Only)
const updateSettings = async (req, res) => {
  try {
    const { companyName, companyAddress, companyPhone, taxRate, currencySymbol } = req.body;
    
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting();
    }

    // Handle Logo Upload (Replace old one)
    if (req.file) {
      if (settings.logo && settings.logo.public_id) {
        await cloudinary.uploader.destroy(settings.logo.public_id);
      }
      settings.logo = {
        url: req.file.path,
        public_id: req.file.filename,
      };
    }

    // Update Text Fields
    settings.companyName = companyName || settings.companyName;
    settings.companyAddress = companyAddress || settings.companyAddress;
    settings.companyPhone = companyPhone || settings.companyPhone;
    settings.taxRate = taxRate !== undefined ? taxRate : settings.taxRate;
    settings.currencySymbol = currencySymbol || settings.currencySymbol;

    const updatedSettings = await settings.save();
    res.json(updatedSettings);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSettings, updateSettings };