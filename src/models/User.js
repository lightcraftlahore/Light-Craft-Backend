const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['Super Admin', 'User'],
    default: 'User',
  },
}, { timestamps: true });

// ✅ FIX: Remove 'next' from parameters and body
userSchema.pre('save', async function() {
  // If password is not modified, simply return (exits the function)
  if (!this.isModified('password')) return;
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // No need to call next() here; when the async function finishes, Mongoose proceeds.
});

// Method: Compare entered password with hashed password in DB
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);