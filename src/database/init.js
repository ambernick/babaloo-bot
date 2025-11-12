const fs = require('fs');
const path = require('path');
const db = require('./connection.js');

async function initializeDatabase() {
  try {
    console.log('📊 Initializing database...');
    
    // Read schema file
    const schema = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );
    
    // Execute schema
    await db.query(schema);
    
    console.log('✅ Database schema created successfully!');
    console.log('🌱 Seeding initial data...');
    
    // Seed initial achievements
    const achievements = [
      ['First Steps', 'Send your first message', 'starter', 10, 0, 25, 'common'],
      ['Chatterbox', 'Send 100 messages', 'engagement', 50, 0, 100, 'common'],
      ['Early Bird', 'Be first chatter 5 times', 'special', 100, 0, 150, 'rare'],
      ['Link Up', 'Connect Discord and Twitch accounts', 'account', 200, 10, 200, 'rare'],
      ['Generous Soul', 'Gift an item to another user', 'social', 50, 0, 75, 'common'],
      ['Level 10', 'Reach level 10', 'milestone', 100, 0, 200, 'uncommon'],
      ['Big Spender', 'Spend 1000 currency', 'economy', 150, 0, 150, 'uncommon'],
      ['Collector', 'Own 10 different items', 'inventory', 200, 0, 200, 'rare']
    ];
    
    for (const ach of achievements) {
      await db.query(
        `INSERT INTO achievements (name, description, category, reward_currency, reward_premium_currency, reward_xp, rarity) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         ON CONFLICT (name) DO NOTHING`,
        ach
      );
    }
    
    console.log('✅ Initial achievements seeded!');
    console.log('🎉 Database ready for use!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

initializeDatabase();