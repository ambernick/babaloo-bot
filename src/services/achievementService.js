// src/services/achievementService.js
const db = require('../database/connection');
const currencyService = require('./currencyService');
const xpService = require('./xpService');
const achievementDefs = require('../config/achievements');

class AchievementService {
  /**
   * Initialize achievements in database from definitions
   * Run this once on bot startup or when adding new achievements
   */
  async initializeAchievements() {
    try {
      for (const [key, ach] of Object.entries(achievementDefs)) {
        await db.query(
          `INSERT INTO achievements (name, description, category, reward_currency, reward_premium_currency, reward_xp, rarity) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           ON CONFLICT (name) DO UPDATE SET
             description = EXCLUDED.description,
             reward_currency = EXCLUDED.reward_currency,
             reward_premium_currency = EXCLUDED.reward_premium_currency,
             reward_xp = EXCLUDED.reward_xp,
             rarity = EXCLUDED.rarity`,
          [
            ach.name,
            ach.description,
            ach.category,
            ach.reward_currency,
            ach.reward_premium_currency || 0,
            ach.reward_xp,
            ach.rarity
          ]
        );
      }
      console.log('✅ Achievements initialized');
    } catch (error) {
      console.error('Error initializing achievements:', error);
    }
  }

  /**
   * Get comprehensive user stats for achievement checking
   */
  async getUserStats(userId) {
    try {
      const result = await db.query(
        `SELECT 
          u.level,
          u.currency,
          u.xp,
          u.twitch_id IS NOT NULL as has_twitch_linked,
          up.streak_days as daily_streak,
          COUNT(DISTINCT CASE WHEN t.type = 'earn' AND t.category = 'chat' THEN t.id END) as message_count,
          COUNT(DISTINCT CASE WHEN t.type = 'spend' THEN t.id END) as purchases,
          COALESCE(SUM(CASE WHEN t.type = 'spend' THEN t.amount ELSE 0 END), 0) as total_spent,
          0 as gifts_sent,
          0 as unique_items,
          0 as total_items
         FROM users u
         LEFT JOIN user_profiles up ON u.id = up.user_id
         LEFT JOIN transactions t ON u.id = t.user_id
         WHERE u.id = $1
         GROUP BY u.id, up.streak_days`,
        [userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }

  /**
   * Auto-check all achievements for a user
   * Returns array of newly unlocked achievements
   */
  async autoCheckAchievements(userId) {
    try {
      const stats = await this.getUserStats(userId);
      if (!stats) return [];

      const newlyUnlocked = [];

      // Check each achievement definition
      for (const [key, ach] of Object.entries(achievementDefs)) {
        // Check if condition is met
        if (ach.checkCondition(stats)) {
          const result = await this.checkAchievement(userId, ach.name);
          
          if (result.success && !result.alreadyCompleted) {
            newlyUnlocked.push(result.achievement);
          }
        }
      }

      return newlyUnlocked;
    } catch (error) {
      console.error('Error auto-checking achievements:', error);
      return [];
    }
  }

  /**
   * Check and award a specific achievement
   */
  async checkAchievement(userId, achievementName) {
    try {
      // Get achievement
      const achResult = await db.query(
        'SELECT * FROM achievements WHERE name = $1',
        [achievementName]
      );

      if (achResult.rows.length === 0) {
        return { success: false, error: 'Achievement not found' };
      }

      const achievement = achResult.rows[0];

      // Check if user already has it
      const userAchResult = await db.query(
        'SELECT * FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
        [userId, achievement.id]
      );

      if (userAchResult.rows.length > 0 && userAchResult.rows[0].completed_at) {
        return { success: false, error: 'Already completed', alreadyCompleted: true };
      }

      // Award achievement
      await db.query(
        `INSERT INTO user_achievements (user_id, achievement_id, progress, required, completed_at)
         VALUES ($1, $2, 1, 1, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, achievement_id) 
         DO UPDATE SET completed_at = CURRENT_TIMESTAMP, progress = 1`,
        [userId, achievement.id]
      );

      // Award rewards
      if (achievement.reward_currency > 0) {
        await currencyService.awardCurrency(
          userId, 
          achievement.reward_currency, 
          'achievement', 
          `Achievement: ${achievement.name}`
        );
      }

      if (achievement.reward_premium_currency > 0) {
        await currencyService.awardPremiumCurrency(
          userId,
          achievement.reward_premium_currency,
          'achievement',
          `Achievement: ${achievement.name}`
        );
      }

      if (achievement.reward_xp > 0) {
        await xpService.awardXP(userId, achievement.reward_xp, 'achievement');
      }

      return {
        success: true,
        achievement,
        rewards: {
          currency: achievement.reward_currency,
          xp: achievement.reward_xp,
          premiumCurrency: achievement.reward_premium_currency
        }
      };
    } catch (error) {
      console.error('Error checking achievement:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Announce achievement unlock in channel
   */
  async announceAchievement(channel, user, achievement) {
    const rarityEmoji = {
      common: '⚪',
      uncommon: '🟢',
      rare: '🔵',
      epic: '🟣',
      legendary: '🟠'
    };

    const embed = {
      color: 0xFFD700,
      title: '🏆 Achievement Unlocked!',
      description: `**${user.username}** earned **${achievement.name}**!`,
      fields: [
        {
          name: achievement.name,
          value: achievement.description,
          inline: false
        },
        {
          name: 'Rarity',
          value: `${rarityEmoji[achievement.rarity]} ${achievement.rarity.toUpperCase()}`,
          inline: true
        },
        {
          name: 'Rewards',
          value: this.formatRewards(achievement),
          inline: true
        }
      ],
      thumbnail: { url: user.displayAvatarURL({ dynamic: true }) },
      timestamp: new Date()
    };

    await channel.send({ embeds: [embed] });
  }

  formatRewards(achievement) {
    const parts = [];
    if (achievement.reward_currency > 0) {
      parts.push(`+${achievement.reward_currency} 🪙`);
    }
    if (achievement.reward_premium_currency > 0) {
      parts.push(`+${achievement.reward_premium_currency} 💎`);
    }
    if (achievement.reward_xp > 0) {
      parts.push(`+${achievement.reward_xp} XP`);
    }
    return parts.join('\n') || 'None';
  }

  // Keep existing methods: getAllAchievements, getUserAchievements, etc.
  async getAllAchievements() {
    try {
      const result = await db.query(
        'SELECT * FROM achievements ORDER BY category, name'
      );
      return { success: true, achievements: result.rows };
    } catch (error) {
      console.error('Error getting achievements:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserAchievements(userId) {
    try {
      const result = await db.query(
        `SELECT 
          a.*,
          ua.progress,
          ua.completed_at,
          ua.required
         FROM achievements a
         LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
         ORDER BY ua.completed_at DESC NULLS LAST, a.category, a.name`,
        [userId]
      );
      return { success: true, achievements: result.rows };
    } catch (error) {
      console.error('Error getting user achievements:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Store a pending achievement notification for later display
   */
  async storePendingNotification(userId, achievementId) {
    try {
      await db.query(
        'INSERT INTO pending_achievement_notifications (user_id, achievement_id) VALUES ($1, $2)',
        [userId, achievementId]
      );
      return { success: true };
    } catch (error) {
      console.error('Error storing pending notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get and clear pending achievement notifications for a user
   * Returns array of achievement objects
   */
  async getPendingNotifications(userId) {
    try {
      const result = await db.query(
        `SELECT a.*
         FROM pending_achievement_notifications pan
         JOIN achievements a ON pan.achievement_id = a.id
         WHERE pan.user_id = $1
         ORDER BY pan.created_at ASC`,
        [userId]
      );

      if (result.rows.length > 0) {
        // Clear the pending notifications
        await db.query(
          'DELETE FROM pending_achievement_notifications WHERE user_id = $1',
          [userId]
        );
      }

      return result.rows;
    } catch (error) {
      console.error('Error getting pending notifications:', error);
      return [];
    }
  }
}

module.exports = new AchievementService();