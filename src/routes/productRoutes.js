const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, admin } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Base Route: /api/products

router
  .route('/')
  .get(protect, getProducts) // Viewable by any logged-in user
  .post(protect, admin, upload.single('image'), createProduct); // Only Admin can create

router
  .route('/:id')
  .get(protect, getProductById)
  .put(protect, admin, upload.single('image'), updateProduct) // Only Admin can edit
  .delete(protect, admin, deleteProduct); // Only Admin can delete

module.exports = router;