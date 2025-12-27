const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool with retry configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  // Connection pool settings
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // 10 seconds to establish connection
});

// Log when connected
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

// Log errors (don't exit - let app handle reconnection)
pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  // Don't exit - PostgreSQL pool will attempt to reconnect
});

// Test connection function
async function testConnection() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

// Export query function
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  testConnection
};