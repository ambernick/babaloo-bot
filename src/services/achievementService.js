const db = require('../database/connection');
const currencyService = require('./currencyService');
const xpService = require('./xpService');

class AchievementService {
  // Get all achievements
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

  // Get user's achievements
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

  // Check and award achievement
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

  // Update achievement progress
  async updateProgress(userId, achievementName, progress) {
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

      // Get or create user achievement record
      let userAch = await db.query(
        'SELECT * FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
        [userId, achievement.id]
      );

      if (userAch.rows.length === 0) {
        // Create new record
        await db.query(
          `INSERT INTO user_achievements (user_id, achievement_id, progress, required)
           VALUES ($1, $2, $3, 1)`,
          [userId, achievement.id, progress]
        );
      } else if (!userAch.rows[0].completed_at) {
        // Update progress if not completed
        await db.query(
          'UPDATE user_achievements SET progress = $1 WHERE user_id = $2 AND achievement_id = $3',
          [progress, userId, achievement.id]
        );

        // Check if now completed
        if (progress >= userAch.rows[0].required) {
          return await this.checkAchievement(userId, achievementName);
        }
      }

      return { success: true, progress };
    } catch (error) {
      console.error('Error updating progress:', error);
      return { success: false, error: error.message };
    }
  }

  // Auto-check achievements based on stats
  async autoCheckAchievements(userId) {
    try {
      // Get user stats
      const stats = await db.query(
        `SELECT 
          u.level,
          u.currency,
          u.xp,
          (SELECT COUNT(*) FROM transactions WHERE user_id = u.id AND type = 'earn' AND category = 'chat') as message_count,
          (SELECT COUNT(*) FROM user_achievements WHERE user_id = u.id AND completed_at IS NOT NULL) as achievements_completed
         FROM users u
         WHERE u.id = $1`,
        [userId]
      );

      if (stats.rows.length === 0) return;

      const userStats = stats.rows[0];
      const awarded = [];

      // Check "First Steps" (send first message)
      if (userStats.message_count >= 1) {
        const result = await this.checkAchievement(userId, 'First Steps');
        if (result.success) awarded.push(result.achievement);
      }

      // Check "Chatterbox" (100 messages)
      if (userStats.message_count >= 100) {
        const result = await this.checkAchievement(userId, 'Chatterbox');
        if (result.success) awarded.push(result.achievement);
      }

      // Check "Level 10"
      if (userStats.level >= 10) {
        const result = await this.checkAchievement(userId, 'Level 10');
        if (result.success) awarded.push(result.achievement);
      }

      return { success: true, awarded };
    } catch (error) {
      console.error('Error auto-checking achievements:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AchievementService();