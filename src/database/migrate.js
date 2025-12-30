// Migration script to add pending_achievement_notifications table
require('dotenv').config();
const db = require('./connection');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('Running migration: add_pending_notifications.sql');

    const migrationPath = path.join(__dirname, 'migrations', 'add_pending_notifications.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await db.query(migrationSQL);

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
