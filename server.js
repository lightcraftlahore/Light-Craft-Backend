require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

// Connect to Database immediately
connectDB();

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;