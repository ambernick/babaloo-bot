// Check achievement notification channel setting
const db = require('../src/database/connection');

async function checkSetting() {
  try {
    console.log('🔍 Checking achievement notification channel setting...\n');

    const result = await db.query(
      'SELECT * FROM bot_settings WHERE key = $1',
      ['achievement_notification_channel_id']
    );

    if (result.rows.length > 0) {
      const setting = result.rows[0];
      console.log('✅ Setting found in database:');
      console.log(`   Key: ${setting.key}`);
      console.log(`   Value: "${setting.value}"`);
      console.log(`   Description: ${setting.description}`);

      if (setting.value && setting.value.trim() !== '') {
        console.log(`\n📢 Achievement notifications will be sent to channel ID: ${setting.value}`);
      } else {
        console.log('\n📢 Achievement notifications will be sent to the chat channel (default behavior)');
      }
    } else {
      console.log('❌ Setting not found in database');
      console.log('💡 Run: node scripts/add-bot-settings.js');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSetting();
