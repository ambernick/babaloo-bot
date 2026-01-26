// scripts/add-levelup-notification-setting.js
const db = require('../src/database/connection');

async function addLevelupNotificationSetting() {
  try {
    console.log('📊 Adding levelup_notification_channel_id setting...');

    // Check if setting already exists
    const checkResult = await db.query(
      'SELECT * FROM bot_settings WHERE key = $1',
      ['levelup_notification_channel_id']
    );

    if (checkResult.rows.length > 0) {
      console.log('⚠️  Setting already exists, skipping...');
      process.exit(0);
    }

    // Insert the new setting
    await db.query(`
      INSERT INTO bot_settings (key, value, description, category)
      VALUES ($1, $2, $3, $4)
    `, [
      'levelup_notification_channel_id',
      '',
      'Channel ID where level up notifications are sent (leave empty to send in chat channel)',
      'notifications'
    ]);

    console.log('✅ levelup_notification_channel_id setting added successfully!');
    console.log('\n💡 You can now configure this setting:');
    console.log('  - Via slash command: /set-levelup-channel <channel>');
    console.log('  - Via admin dashboard: Bot Settings → Notification Channels');
    console.log('\n🎉 Migration complete!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding levelup notification setting:', error);
    process.exit(1);
  }
}

addLevelupNotificationSetting();
