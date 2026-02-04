const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { createUser, getAllUsers, deleteUser } = require('../controllers/authController');
const { protect, admin } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// --- COMPANY CONFIGURATION ---
// Get Settings (Anyone logged in can see this, e.g., for printing invoices)
router.get('/', protect, getSettings);

// Update Settings (Only Super Admin, supports Logo upload)
router.put('/', protect, admin, upload.single('logo'), updateSettings);


// --- USER MANAGEMENT (For the Settings Page) ---
// Add New User (Super Admin only)
router.post('/users', protect, admin, createUser);

// Get All Users (Super Admin only)
router.get('/users', protect, admin, getAllUsers);

// Delete User (Super Admin only)
router.delete('/users/:id', protect, admin, deleteUser);

module.exports = router;