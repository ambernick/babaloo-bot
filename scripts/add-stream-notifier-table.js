// Script to create stream_notifiers table
require('dotenv').config();
const db = require('../src/database/connection');

async function createTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS stream_notifiers (
        id SERIAL PRIMARY KEY,
        twitch_username VARCHAR(255) NOT NULL UNIQUE,
        twitch_user_id VARCHAR(255),
        custom_message TEXT,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ stream_notifiers table created successfully');
  } catch (error) {
    console.error('❌ Error creating stream_notifiers table:', error);
    throw error;
  } finally {
    await db.pool.end();
  }
}

createTable()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
