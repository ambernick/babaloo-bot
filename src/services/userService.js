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
      // Check if user exists with this Twitch ID (could be Discord account or Twitch-only)
      let result = await db.query(
        'SELECT * FROM users WHERE twitch_id = $1',
        [twitchId]
      );

      if (result.rows.length > 0) {
        return { success: true, user: result.rows[0], isNew: false };
      }

      // Create new Twitch-only user
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

  // Link Twitch account to Discord account (merge accounts)
  async linkTwitchAccount(discordUserId, twitchId, twitchUsername) {
    const achievementService = require('./achievementService');

    try {
      // Get the Discord user
      const discordUserResult = await db.query(
        'SELECT * FROM users WHERE id = $1',
        [discordUserId]
      );

      if (discordUserResult.rows.length === 0) {
        return { success: false, error: 'Discord user not found' };
      }

      const discordUser = discordUserResult.rows[0];

      // Check if Discord account already linked
      if (discordUser.twitch_id) {
        return { success: false, error: 'Discord account already linked to Twitch' };
      }

      // Check if Twitch account exists
      const twitchUserResult = await db.query(
        'SELECT * FROM users WHERE twitch_id = $1',
        [twitchId]
      );

      if (twitchUserResult.rows.length > 0) {
        // Twitch account exists - merge it into Discord account
        const twitchUser = twitchUserResult.rows[0];

        // Start transaction
        await db.query('BEGIN');

        try {
          // Update user_achievements to point to Discord account FIRST
          await db.query(
            'UPDATE user_achievements SET user_id = $1 WHERE user_id = $2',
            [discordUserId, twitchUser.id]
          );

          // Update transactions to point to Discord account
          await db.query(
            'UPDATE transactions SET user_id = $1 WHERE user_id = $2',
            [discordUserId, twitchUser.id]
          );

          // Delete old Twitch-only account BEFORE updating Discord account
          await db.query('DELETE FROM user_profiles WHERE user_id = $1', [twitchUser.id]);
          await db.query('DELETE FROM users WHERE id = $1', [twitchUser.id]);

          // Now add Twitch data to Discord account (combine stats)
          await db.query(
            `UPDATE users
             SET twitch_id = $1,
                 currency = currency + $2,
                 xp = xp + $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [twitchId, twitchUser.currency, twitchUser.xp, discordUserId]
          );

          // Recalculate level based on combined XP
          const updatedUser = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [discordUserId]
          );
          const newLevel = this.calculateLevel(updatedUser.rows[0].xp);

          await db.query(
            'UPDATE users SET level = $1 WHERE id = $2',
            [newLevel, discordUserId]
          );

          await db.query('COMMIT');

          console.log(`✅ Merged Twitch account ${twitchUsername} into Discord account ${discordUser.username}`);

          // Check for Link Up achievement and store as pending notification
          const newAchievements = await achievementService.autoCheckAchievements(discordUserId);

          // Store pending notifications for any newly unlocked achievements
          for (const ach of newAchievements) {
            await achievementService.storePendingNotification(discordUserId, ach.id);
          }

          return {
            success: true,
            merged: true,
            currencyAdded: twitchUser.currency,
            xpAdded: twitchUser.xp,
            newLevel
          };
        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }
      } else {
        // No existing Twitch account - just link the ID
        await db.query(
          'UPDATE users SET twitch_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [twitchId, discordUserId]
        );

        console.log(`✅ Linked Twitch account ${twitchUsername} to Discord account ${discordUser.username}`);

        // Check for Link Up achievement and store as pending notification
        const newAchievements = await achievementService.autoCheckAchievements(discordUserId);

        // Store pending notifications for any newly unlocked achievements
        for (const ach of newAchievements) {
          await achievementService.storePendingNotification(discordUserId, ach.id);
        }

        return { success: true, merged: false };
      }
    } catch (error) {
      console.error('Error linking Twitch account:', error);
      return { success: false, error: error.message };
    }
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