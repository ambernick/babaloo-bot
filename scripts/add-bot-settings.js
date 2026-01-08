// scripts/add-bot-settings.js
const fs = require('fs');
const path = require('path');
const db = require('../src/database/connection');

async function addBotSettings() {
  try {
    console.log('📊 Adding bot_settings table...');

    // Read migration file
    const migration = fs.readFileSync(
      path.join(__dirname, '../src/database/migrations/add_bot_settings.sql'),
      'utf8'
    );

    // Execute migration
    await db.query(migration);

    console.log('✅ bot_settings table created successfully!');
    console.log('✅ Default settings inserted!');
    console.log('\n📋 Default settings added:');
    console.log('  - achievement_notification_channel_id (empty - will send to chat channel)');
    console.log('  - stream_notification_channel_id');
    console.log('  - stream_notification_message');
    console.log('  - stream_notification_role_id');
    console.log('  - XP and currency rate limits');
    console.log('  - Daily bonus amounts');
    console.log('\n🎉 Migration complete!');
    console.log('💡 You can now configure these settings in the dashboard or via slash commands.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding bot_settings:', error);
    process.exit(1);
  }
}

addBotSettings();
