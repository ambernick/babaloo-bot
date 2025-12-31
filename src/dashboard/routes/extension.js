// src/dashboard/routes/extension.js
// Extension Backend Service (EBS) API for Twitch Extension
const express = require('express');
const router = express.Router();
const { verifyTwitchToken } = require('../middleware/twitchAuth');
const userService = require('../../services/userService');
const shopService = require('../../services/shopService');

// All extension routes require Twitch JWT authentication
router.use(verifyTwitchToken);

/**
 * GET /extension/user
 * Get current user's profile and balance
 */
router.get('/user', async (req, res) => {
  try {
    const twitchUserId = req.twitchUserId;

    if (!twitchUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get or create user by Twitch ID
    const userResult = await userService.getUserByTwitchId(twitchUserId);

    if (!userResult.success || !userResult.user) {
      // User not found - they haven't linked their account yet
      return res.json({
        linked: false,
        message: 'Account not linked. Use !link command in chat to connect your account.'
      });
    }

    const user = userResult.user;

    res.json({
      linked: true,
      user: {
        id: user.id,
        username: user.username,
        currency: user.currency,
        premium_currency: user.premium_currency,
        xp: user.xp,
        level: user.level,
        has_discord: !!user.discord_id,
        has_twitch: !!user.twitch_id
      }
    });
  } catch (error) {
    console.error('Error getting extension user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /extension/shop
 * Get all available shop items
 */
router.get('/shop', async (req, res) => {
  try {
    const category = req.query.category || null;
    const result = await shopService.getShopItems(category);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ items: result.items });
  } catch (error) {
    console.error('Error getting shop items for extension:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /extension/shop/:itemId/redeem
 * Redeem a shop item
 */
router.post('/shop/:itemId/redeem', async (req, res) => {
  try {
    const twitchUserId = req.twitchUserId;
    const itemId = parseInt(req.params.itemId);
    const userInput = req.body.userInput || null;

    if (!twitchUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user by Twitch ID
    const userResult = await userService.getUserByTwitchId(twitchUserId);

    if (!userResult.success || !userResult.user) {
      return res.status(404).json({
        error: 'Account not linked. Use !link command in chat to connect your account.'
      });
    }

    const user = userResult.user;

    // Attempt redemption
    const redemptionResult = await shopService.redeemItem(user.id, itemId, userInput);

    if (!redemptionResult.success) {
      return res.status(400).json({ error: redemptionResult.error });
    }

    res.json({
      success: true,
      message: redemptionResult.message,
      redemptionId: redemptionResult.redemptionId
    });
  } catch (error) {
    console.error('Error redeeming item in extension:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /extension/redemptions
 * Get user's redemption history
 */
router.get('/redemptions', async (req, res) => {
  try {
    const twitchUserId = req.twitchUserId;
    const limit = parseInt(req.query.limit) || 20;

    if (!twitchUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user by Twitch ID
    const userResult = await userService.getUserByTwitchId(twitchUserId);

    if (!userResult.success || !userResult.user) {
      return res.json({ redemptions: [] });
    }

    const user = userResult.user;

    // Get redemptions
    const redemptionsResult = await shopService.getUserRedemptions(user.id, limit);

    if (!redemptionsResult.success) {
      return res.status(500).json({ error: redemptionsResult.error });
    }

    res.json({ redemptions: redemptionsResult.redemptions });
  } catch (error) {
    console.error('Error getting redemptions for extension:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /extension/shop/:itemId/can-redeem
 * Check if user can redeem an item (cooldowns, stock, balance)
 */
router.get('/shop/:itemId/can-redeem', async (req, res) => {
  try {
    const twitchUserId = req.twitchUserId;
    const itemId = parseInt(req.params.itemId);

    if (!twitchUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user by Twitch ID
    const userResult = await userService.getUserByTwitchId(twitchUserId);

    if (!userResult.success || !userResult.user) {
      return res.json({
        canRedeem: false,
        reason: 'Account not linked'
      });
    }

    const user = userResult.user;

    // Check if can redeem
    const canRedeemResult = await shopService.canRedeem(user.id, itemId);

    res.json(canRedeemResult);
  } catch (error) {
    console.error('Error checking can redeem for extension:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;