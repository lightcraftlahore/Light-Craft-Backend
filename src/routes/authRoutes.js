const express = require('express');
const router = express.Router();
// 1. Import getAllUsers and deleteUser from controller
const { 
  loginUser, 
  createUser, 
  getAllUsers, 
  deleteUser 
} = require('../controllers/authController');

const { protect, admin } = require('../middlewares/authMiddleware');

// Public Route
router.post('/login', loginUser);

// Protected Routes
router.post('/create-user', protect, admin, createUser);

// 2. Add this route (Fixes the "Disappear on Refresh" issue)
router.get('/users', protect, admin, getAllUsers);

// 3. Add this route (Allows deleting users)
router.delete('/users/:id', protect, admin, deleteUser);

module.exports = router;