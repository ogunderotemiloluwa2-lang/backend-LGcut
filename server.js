// LG CUT Backend Server
// Express server with in-memory data store

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables FIRST, before any module that reads process.env
// (e.g. notifications.js) is required.
dotenv.config();

const routes = require('./routes');
const adminRoutes = require('./adminRoutes');
const { ensureDatabase } = require('./dataStore');

const app = express();
const PORT = process.env.PORT || 3001;

// Allowed origins: comma-separated list in FRONTEND_URL (e.g. local + Netlify).
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / tools with no Origin header (curl, health checks).
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  })
);
app.use(express.json());

// Routes
app.use('/api', routes);
app.use('/api/admin', adminRoutes);

// Start server
ensureDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 LG CUT Backend API running on port ${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
      console.log('');
    });
  })
  .catch((error) => {
    console.error('Unable to initialize backend data store:', error.message);
    process.exit(1);
  });
