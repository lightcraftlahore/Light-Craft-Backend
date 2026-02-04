const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error('Please define the MONGO_URI environment variable');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  // 1. If connection is already cached, return it immediately
  if (cached.conn) {
    return cached.conn;
  }

  // 2. If no connection promise exists, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Stops buffering error
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000, // Fail fast
    };

    cached.promise = mongoose.connect(MONGO_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  // 3. Await the connection
  try {
    cached.conn = await cached.promise;
    console.log(`MongoDB Connected: ${cached.conn.connection.host}`);

    // --- AUTO-SEED SUPER ADMIN (Runs only on fresh connection) ---
    const adminEmail = 'lightcraft@codeenvision.com';
    
    // We use a try-catch here so DB connection doesn't fail if seeding errors out
    try {
      const adminExists = await User.findOne({ email: adminEmail });

      if (!adminExists) {
        console.log('Admin not found. Creating default Super Admin...');
        
        const superAdmin = new User({
          name: 'Super Admin',
          email: adminEmail,
          password: 'ABC@123!', // User model pre-save hook will hash this
          role: 'Super Admin',
        });

        await superAdmin.save();
        console.log('✅ Default Super Admin Created Successfully');
      } else {
        console.log('ℹ️ Super Admin already exists.');
      }
    } catch (seedError) {
      console.error('⚠️ Error seeding admin:', seedError.message);
      // We do NOT throw here, because we still want the DB connection to succeed
    }
    // -------------------------------------------------------------

  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

module.exports = connectDB;
