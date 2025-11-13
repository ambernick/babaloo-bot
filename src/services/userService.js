const db = require('../database/connection');

class UserService {
  // Get or create user (auto-registration)
  async getOrCreateUser(discordId, username) {
    try {
      // Check if user exists
      let result = await db.query(
        'SELECT * FROM users WHERE discord_id = $1',
        [discordId]
      );

      if (result.rows.length > 0) {
        return { success: true, user: result.rows[0], isNew: false };
      }

      // Create new user
      result = await db.query(
        `INSERT INTO users (discord_id, username, currency, xp, level) 
         VALUES ($1, $2, 0, 0, 1) 
         RETURNING *`,
        [discordId, username]
      );

      // Create user profile
      await db.query(
        'INSERT INTO user_profiles (user_id) VALUES ($1)',
        [result.rows[0].id]
      );

      console.log(`✅ New user registered: ${username}`);
      return { success: true, user: result.rows[0], isNew: true };
    } catch (error) {
      console.error('Error in getOrCreateUser:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user by Discord ID
  async getUser(discordId) {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE discord_id = $1',
        [discordId]
      );
      
      if (result.rows.length === 0) {
        return { success: false, error: 'User not found' };
      }
      
      return { success: true, user: result.rows[0] };
    } catch (error) {
      console.error('Error in getUser:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user stats
  async getUserStats(discordId) {
    try {
      const result = await db.query(
        `SELECT 
          u.username,
          u.currency,
          u.premium_currency
          u.xp,
          u.level,
          u.created_at,
          COUNT(DISTINCT ua.id) as achievements_completed,
          COUNT(DISTINCT t.id) as total_transactions
         FROM users u
         LEFT JOIN user_achievements ua ON u.id = ua.user_id AND ua.completed_at IS NOT NULL
         LEFT JOIN transactions t ON u.id = t.user_id
         WHERE u.discord_id = $1
         GROUP BY u.id`,
        [discordId]
      );
      
      if (result.rows.length === 0) {
        return { success: false, error: 'User not found' };
      }
      
      return { success: true, stats: result.rows[0] };
    } catch (error) {
      console.error('Error in getUserStats:', error);
      return { success: false, error: error.message };
    }
  }

  // Calculate level from XP
  calculateLevel(xp) {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  // Calculate XP needed for next level
  xpForNextLevel(currentLevel) {
    return (currentLevel ** 2) * 100;
  }
}

module.exports = new UserService();