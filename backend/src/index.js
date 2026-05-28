const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const walletRoutes = require('./routes/walletRoutes');
const lendingRoutes = require('./routes/lendingRoutes');
const investmentRoutes = require('./routes/investmentRoutes');
const insuranceRoutes = require('./routes/insuranceRoutes');
const rewardsRoutes = require('./routes/rewardsRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const securityRoutes = require('./routes/securityRoutes');
const adminRoutes = require('./routes/adminRoutes');
const seedDatabase = require('./config/seeder');

// Run DB seeder
seedDatabase().catch(err => console.error('Seeder failed:', err));


const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend integration
app.use(cors({
  origin: '*', // Adjust this for production to match frontend domains
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// HTTP request logger
app.use(morgan('dev'));

// JSON body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Server API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/lending', lendingRoutes);
app.use('/api/v1/investments', investmentRoutes);
app.use('/api/v1/insurance', insuranceRoutes);
app.use('/api/v1/rewards', rewardsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/admin', adminRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Root route
app.get('/', (req, res) => {
  res.send('E-Faws AI-powered Fintech API Server is running.');
});

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error. Please contact admin.' });
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
