const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');

      // ✅ ADD 'return' to stop execution here
      return next(); 
    } catch (error) {
      console.error(error);
      // ✅ ADD 'return' to ensure we don't accidentally send two responses
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'Super Admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, admin };