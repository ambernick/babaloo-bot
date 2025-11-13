const db = require('../database/connection');

class XPService {
  // Award XP and check for level up
  async awardXP(userId, amount, category = 'chat') {
    try {
      // Get current user data
      const userResult = await db.query(
        'SELECT xp, level FROM users WHERE id = $1',
        [userId]
      );

      const currentXP = userResult.rows[0].xp;
      const currentLevel = userResult.rows[0].level;
      const newXP = currentXP + amount;
      const newLevel = this.calculateLevel(newXP);

      // Update XP
      await db.query(
        `UPDATE users 
         SET xp = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [newXP, userId]
      );

      // Check for level up
      if (newLevel > currentLevel) {
        await db.query(
          'UPDATE users SET level = $1 WHERE id = $2',
          [newLevel, userId]
        );

        return { 
          success: true, 
          xp: newXP, 
          leveledUp: true, 
          oldLevel: currentLevel, 
          newLevel: newLevel 
        };
      }

      return { success: true, xp: newXP, leveledUp: false };
    } catch (error) {
      console.error('Error awarding XP:', error);
      return { success: false, error: error.message };
    }
  }

  // Calculate level from XP (exponential curve)
  calculateLevel(xp) {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  // Calculate XP needed for next level
  xpForLevel(level) {
    return (level - 1) ** 2 * 100;
  }

  // Get XP progress to next level
  getLevelProgress(currentXP, currentLevel) {
    const xpForCurrent = this.xpForLevel(currentLevel);
    const xpForNext = this.xpForLevel(currentLevel + 1);
    const xpProgress = currentXP - xpForCurrent;
    const xpNeeded = xpForNext - xpForCurrent;
    const progressPercent = Math.round((xpProgress / xpNeeded) * 100);

    return {
      currentXP,
      currentLevel,
      xpProgress,
      xpNeeded,
      xpForNext,
      progressPercent
    };
  }
}

module.exports = new XPService();