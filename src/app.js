const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();

// 1. Precise CORS (Must be before routes)
app.use(cors({
    origin: 'https://light-craft-zeta.vercel.app',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());
app.use(morgan('dev'));

// 2. Simple Health Check
app.get('/', (req, res) => {
    res.send('API is running successfully!');
});

// 3. Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

module.exports = app;