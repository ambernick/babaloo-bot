const db = require('../database/connection');
const userService = require('./userService');

class CurrencyService {
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

      return { success: true, user: result.rows[0], earned: amount };
    } catch (error) {
      console.error('Error awarding currency:', error);
      return { success: false, error: error.message };
    }
  }

  // Spend currency
  async spendCurrency(userId, amount, category = 'purchase', description = '') {
    try {
      // Check if user has enough
      const userResult = await db.query(
        'SELECT currency FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows[0].currency < amount) {
        return { success: false, error: 'Insufficient funds' };
      }

      // Deduct currency
      const result = await db.query(
        `UPDATE users 
         SET currency = currency - $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [amount, userId]
      );

      // Log transaction
      await db.query(
        `INSERT INTO transactions (user_id, type, category, amount, description) 
         VALUES ($1, 'spend', $2, $3, $4)`,
        [userId, category, amount, description]
      );

      return { success: true, user: result.rows[0], spent: amount };
    } catch (error) {
      console.error('Error spending currency:', error);
      return { success: false, error: error.message };
    }
  }

  // Get balance
  async getBalance(userId) {
    try {
      const result = await db.query(
        'SELECT currency, premium_currency FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, balance: result.rows[0] };
    } catch (error) {
      console.error('Error getting balance:', error);
      return { success: false, error: error.message };
    }
  }

  // Daily bonus
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
            error: `You already claimed your daily bonus! Try again in ${hoursRemaining} hours.`,
            hoursRemaining 
          };
        }
      }

      // Award daily bonus
      const dailyAmount = 100;
      await this.awardCurrency(userId, dailyAmount, 'daily', 'Daily bonus');

      return {
        success: true,
        amount: dailyAmount,
        message: `Daily bonus claimed! +${dailyAmount} 🪙`
      };
    } catch (error) {
      console.error('Error claiming daily:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CurrencyService();