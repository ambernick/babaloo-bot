const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Log when connected
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

// Log errors
pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Export query function
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};