// src/services/shopService.js
const db = require('../database/connection');
const currencyService = require('./currencyService');

class ShopService {
  /**
   * Get all enabled shop items
   */
  async getShopItems(category = null) {
    try {
      let query = `
        SELECT
          id, name, description, cost, currency_type, category,
          icon_url, stock, cooldown_minutes, global_cooldown_minutes,
          requires_input, input_prompt
        FROM shop_items
        WHERE enabled = TRUE
      `;
      const params = [];

      if (category) {
        query += ' AND category = $1';
        params.push(category);
      }

      query += ' ORDER BY category, cost ASC';

      const result = await db.query(query, params);
      return { success: true, items: result.rows };
    } catch (error) {
      console.error('Error getting shop items:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get a specific shop item by ID
   */
  async getShopItem(itemId) {
    try {
      const result = await db.query(
        'SELECT * FROM shop_items WHERE id = $1',
        [itemId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Item not found' };
      }

      return { success: true, item: result.rows[0] };
    } catch (error) {
      console.error('Error getting shop item:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user can redeem an item (cooldowns, stock, balance)
   */
  async canRedeem(userId, itemId) {
    try {
      // Get item details
      const itemResult = await this.getShopItem(itemId);
      if (!itemResult.success) {
        return { canRedeem: false, reason: 'Item not found' };
      }

      const item = itemResult.item;

      // Check if item is enabled
      if (!item.enabled) {
        return { canRedeem: false, reason: 'Item is not available' };
      }

      // Check stock
      if (item.stock !== -1 && item.stock <= 0) {
        return { canRedeem: false, reason: 'Out of stock' };
      }

      // Check user balance
      const userResult = await db.query(
        'SELECT currency, premium_currency FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return { canRedeem: false, reason: 'User not found' };
      }

      const user = userResult.rows[0];
      const userBalance = item.currency_type === 'premium'
        ? user.premium_currency
        : user.currency;

      if (userBalance < item.cost) {
        return { canRedeem: false, reason: 'Insufficient balance' };
      }

      // Check user cooldown
      if (item.cooldown_minutes > 0) {
        const cooldownResult = await db.query(
          'SELECT can_redeem_at FROM user_item_cooldowns WHERE user_id = $1 AND shop_item_id = $2',
          [userId, itemId]
        );

        if (cooldownResult.rows.length > 0) {
          const canRedeemAt = new Date(cooldownResult.rows[0].can_redeem_at);
          const now = new Date();

          if (now < canRedeemAt) {
            const minutesLeft = Math.ceil((canRedeemAt - now) / 1000 / 60);
            return {
              canRedeem: false,
              reason: `On cooldown for ${minutesLeft} more minute(s)`
            };
          }
        }
      }

      // Check global cooldown
      if (item.global_cooldown_minutes > 0) {
        const globalCooldownResult = await db.query(
          'SELECT can_redeem_at FROM global_item_cooldowns WHERE shop_item_id = $1',
          [itemId]
        );

        if (globalCooldownResult.rows.length > 0) {
          const canRedeemAt = new Date(globalCooldownResult.rows[0].can_redeem_at);
          const now = new Date();

          if (now < canRedeemAt) {
            const minutesLeft = Math.ceil((canRedeemAt - now) / 1000 / 60);
            return {
              canRedeem: false,
              reason: `Global cooldown active for ${minutesLeft} more minute(s)`
            };
          }
        }
      }

      return { canRedeem: true };
    } catch (error) {
      console.error('Error checking if user can redeem:', error);
      return { canRedeem: false, reason: 'Error checking redemption status' };
    }
  }

  /**
   * Redeem a shop item
   */
  async redeemItem(userId, itemId, userInput = null) {
    try {
      // Check if user can redeem
      const canRedeemResult = await this.canRedeem(userId, itemId);
      if (!canRedeemResult.canRedeem) {
        return { success: false, error: canRedeemResult.reason };
      }

      const itemResult = await this.getShopItem(itemId);
      const item = itemResult.item;

      // Start transaction
      await db.query('BEGIN');

      try {
        // Deduct currency
        const spendResult = await currencyService.spendCurrency(
          userId,
          item.cost,
          'shop',
          `Redeemed: ${item.name}`,
          item.currency_type
        );

        if (!spendResult.success) {
          await db.query('ROLLBACK');
          return { success: false, error: 'Failed to deduct currency' };
        }

        // Update stock if limited
        if (item.stock !== -1) {
          await db.query(
            'UPDATE shop_items SET stock = stock - 1 WHERE id = $1',
            [itemId]
          );
        }

        // Create redemption record
        const status = item.auto_fulfill ? 'fulfilled' : 'pending';
        const redemptionResult = await db.query(
          `INSERT INTO redemptions
           (user_id, shop_item_id, cost, currency_type, status, user_input)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [userId, itemId, item.cost, item.currency_type, status, userInput]
        );

        const redemptionId = redemptionResult.rows[0].id;

        // Set user cooldown if applicable
        if (item.cooldown_minutes > 0) {
          const canRedeemAt = new Date(Date.now() + item.cooldown_minutes * 60000);
          await db.query(
            `INSERT INTO user_item_cooldowns (user_id, shop_item_id, can_redeem_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, shop_item_id)
             DO UPDATE SET can_redeem_at = $3`,
            [userId, itemId, canRedeemAt]
          );
        }

        // Set global cooldown if applicable
        if (item.global_cooldown_minutes > 0) {
          const canRedeemAt = new Date(Date.now() + item.global_cooldown_minutes * 60000);
          await db.query(
            `INSERT INTO global_item_cooldowns (shop_item_id, can_redeem_at)
             VALUES ($1, $2)
             ON CONFLICT (shop_item_id)
             DO UPDATE SET can_redeem_at = $2`,
            [itemId, canRedeemAt]
          );
        }

        await db.query('COMMIT');

        return {
          success: true,
          redemptionId,
          message: item.auto_fulfill
            ? 'Redemption completed!'
            : 'Redemption submitted! Waiting for approval.'
        };
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error redeeming item:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's redemption history
   */
  async getUserRedemptions(userId, limit = 50) {
    try {
      const result = await db.query(
        `SELECT
          r.id,
          r.cost,
          r.currency_type,
          r.status,
          r.user_input,
          r.created_at,
          r.fulfilled_at,
          si.name as item_name,
          si.description as item_description
         FROM redemptions r
         LEFT JOIN shop_items si ON r.shop_item_id = si.id
         WHERE r.user_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return { success: true, redemptions: result.rows };
    } catch (error) {
      console.error('Error getting user redemptions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all pending redemptions (for admin)
   */
  async getPendingRedemptions() {
    try {
      const result = await db.query(
        `SELECT
          r.id,
          r.cost,
          r.currency_type,
          r.user_input,
          r.created_at,
          u.discord_id,
          u.twitch_id,
          u.username,
          si.name as item_name,
          si.description as item_description,
          si.requires_input
         FROM redemptions r
         JOIN users u ON r.user_id = u.id
         LEFT JOIN shop_items si ON r.shop_item_id = si.id
         WHERE r.status = 'pending'
         ORDER BY r.created_at ASC`
      );

      return { success: true, redemptions: result.rows };
    } catch (error) {
      console.error('Error getting pending redemptions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fulfill a redemption (admin action)
   */
  async fulfillRedemption(redemptionId, adminUserId, notes = null) {
    try {
      const result = await db.query(
        `UPDATE redemptions
         SET status = 'fulfilled',
             fulfilled_by = $2,
             fulfilled_at = CURRENT_TIMESTAMP,
             notes = $3
         WHERE id = $1
         RETURNING *`,
        [redemptionId, adminUserId, notes]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Redemption not found' };
      }

      return { success: true, redemption: result.rows[0] };
    } catch (error) {
      console.error('Error fulfilling redemption:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Refund a redemption (admin action)
   */
  async refundRedemption(redemptionId, adminUserId, reason = null) {
    try {
      await db.query('BEGIN');

      try {
        // Get redemption details
        const redemptionResult = await db.query(
          'SELECT * FROM redemptions WHERE id = $1',
          [redemptionId]
        );

        if (redemptionResult.rows.length === 0) {
          await db.query('ROLLBACK');
          return { success: false, error: 'Redemption not found' };
        }

        const redemption = redemptionResult.rows[0];

        // Refund currency
        await currencyService.awardCurrency(
          redemption.user_id,
          redemption.cost,
          'refund',
          `Refund: ${reason || 'Redemption cancelled'}`,
          redemption.currency_type
        );

        // Update redemption status
        await db.query(
          `UPDATE redemptions
           SET status = 'refunded',
               refunded = TRUE,
               fulfilled_by = $2,
               fulfilled_at = CURRENT_TIMESTAMP,
               notes = $3
           WHERE id = $1`,
          [redemptionId, adminUserId, reason]
        );

        // Restore stock if item had limited stock
        if (redemption.shop_item_id) {
          const itemResult = await db.query(
            'SELECT stock FROM shop_items WHERE id = $1',
            [redemption.shop_item_id]
          );

          if (itemResult.rows.length > 0 && itemResult.rows[0].stock !== -1) {
            await db.query(
              'UPDATE shop_items SET stock = stock + 1 WHERE id = $1',
              [redemption.shop_item_id]
            );
          }
        }

        await db.query('COMMIT');

        return { success: true, message: 'Redemption refunded successfully' };
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error refunding redemption:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ShopService();