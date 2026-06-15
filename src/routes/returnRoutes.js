const express = require('express');
const router = express.Router();
const { 
  createReturn, 
  getReturns, 
  getReturnById 
} = require('../controllers/returnController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .post(protect, createReturn)
  .get(protect, getReturns);

router.route('/:id')
  .get(protect, getReturnById);

module.exports = router;
