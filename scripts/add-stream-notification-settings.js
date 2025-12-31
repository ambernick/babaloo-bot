// Script to add stream notification settings to bot_settings table
require('dotenv').config();
const db = require('../src/database/connection');

async function addStreamNotificationSettings() {
  try {
    console.log('Adding stream notification settings...');

    const settings = [
      {
        key: 'stream_notification_channel_id',
        value: '',
        description: 'Discord channel ID for stream live notifications',
        category: 'notifications'
      },
      {
        key: 'stream_notification_message',
        value: '@everyone 🔴 **{username} is now LIVE!**',
        description: 'Custom message for stream notifications (use {username}, {title}, {game}, {url})',
        category: 'notifications'
      },
      {
        key: 'stream_notification_role_id',
        value: 'everyone',
        description: 'Role ID to mention (use "everyone" for @everyone or role ID)',
        category: 'notifications'
      }
    ];

    for (const setting of settings) {
      await db.query(`
        INSERT INTO bot_settings (key, value, description, category)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO UPDATE
        SET description = $3, category = $4
      `, [setting.key, setting.value, setting.description, setting.category]);

      console.log(`✅ Added/updated setting: ${setting.key}`);
    }

    console.log('✅ Stream notification settings added successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding stream notification settings:', error);
    process.exit(1);
  }
}

addStreamNotificationSettings();
