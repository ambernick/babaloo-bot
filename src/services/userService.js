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
  // Award currency to user
  async awardCurrency(userId, amount, category = 'chat', description = '') {
    try {
      // Update user currency
      const result = await db.query(
        `UPDATE users 
         SET currency = currency + $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [amount, userId]
      );

      // Log transaction
      await db.query(
        `INSERT INTO transactions (user_id, type, category, amount, description) 
         VALUES ($1, 'earn', $2, $3, $4)`,
        [userId, category, amount, description]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error awarding currency:', error);
      throw error;
    }
  }

  // Award XP and check for level up
  async awardXP(userId, amount, category = 'chat') {
    try {
      const result = await db.query(
        `UPDATE users 
         SET xp = xp + $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [amount, userId]
      );

      const user = result.rows[0];
      const oldLevel = user.level;
      const newLevel = this.calculateLevel(user.xp);

      // Level up!
      if (newLevel > oldLevel) {
        await db.query(
          'UPDATE users SET level = $1 WHERE id = $2',
          [newLevel, userId]
        );

        return { ...user, level: newLevel, leveledUp: true, oldLevel, newLevel };
      }

      return { ...user, leveledUp: false };
    } catch (error) {
      console.error('Error awarding XP:', error);
      throw error;
    }
  }

  // Get or create user by Twitch ID
  async getOrCreateUserByTwitch(twitchId, username) {
    try {
      // Check if user exists
      let result = await db.query(
        'SELECT * FROM users WHERE twitch_id = $1',
        [twitchId]
      );

      if (result.rows.length > 0) {
        return { success: true, user: result.rows[0], isNew: false };
      }

      // Create new user with Twitch ID
      result = await db.query(
        `INSERT INTO users (twitch_id, username, currency, xp, level)
         VALUES ($1, $2, 0, 0, 1)
         RETURNING *`,
        [twitchId, username]
      );

      // Create user profile
      await db.query(
        'INSERT INTO user_profiles (user_id) VALUES ($1)',
        [result.rows[0].id]
      );

      console.log(`✅ New Twitch user registered: ${username}`);
      return { success: true, user: result.rows[0], isNew: true };
    } catch (error) {
      console.error('Error in getOrCreateUserByTwitch:', error);
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
          u.premium_currency,
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
   // Get user balance
   async getBalance(discordId) {
    const result = await db.query(
      'SELECT currency, premium_currency, xp, level FROM users WHERE discord_id = $1',
      [discordId]
    );
    return result.rows[0] || null;
  }
  // Daily bonus (can only claim once per 24 hours)
  async claimDaily(userId) {
    try {
      // Check last daily claim
      const lastClaim = await db.query(
        `SELECT created_at FROM transactions 
         WHERE user_id = $1 AND category = 'daily' 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (lastClaim.rows.length > 0) {
        const lastClaimTime = new Date(lastClaim.rows[0].created_at);
        const now = new Date();
        const hoursSinceLastClaim = (now - lastClaimTime) / (1000 * 60 * 60);

        if (hoursSinceLastClaim < 24) {
          const hoursRemaining = Math.ceil(24 - hoursSinceLastClaim);
          return { 
            success: false, 
            message: `You already claimed your daily bonus! Try again in ${hoursRemaining} hours.`,
            hoursRemaining 
          };
        }
      }

      // Award daily bonus
      const dailyAmount = 100;
      const dailyXP = 50;

      await this.awardCurrency(userId, dailyAmount, 'daily', 'Daily bonus');
      await this.awardXP(userId, dailyXP, 'daily');

      return {
        success: true,
        currency: dailyAmount,
        xp: dailyXP,
        message: `Daily bonus claimed! +${dailyAmount} 🪙 +${dailyXP} XP`
      };
    } catch (error) {
      console.error('Error claiming daily:', error);
      throw error;
    }
  }

}


module.exports = new UserService();