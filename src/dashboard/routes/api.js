// src/dashboard/routes/api.js
const express = require('express');
const router = express.Router();
const userService = require('../../services/userService');
const db = require('../../database/connection');

// Get user stats
router.get('/user/:discordId/stats', async (req, res) => {
  try {
    const { discordId } = req.params;
    
    // Security: Users can only view their own stats unless admin
    if (discordId !== req.user.id && req.user.id !== process.env.ADMIN_USER_ID) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const statsResult = await userService.getUserStats(discordId);
    
    if (!statsResult.success) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(statsResult.stats);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get leaderboard
router.get('/leaderboard/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    let query;
    switch (category) {
      case 'currency':
        query = 'SELECT discord_id, username, currency FROM users ORDER BY currency DESC LIMIT $1';
        break;
      case 'xp':
        query = 'SELECT discord_id, username, xp, level FROM users ORDER BY xp DESC LIMIT $1';
        break;
      case 'achievements':
        query = `SELECT u.discord_id, u.username, COUNT(ua.id) as count 
                 FROM users u 
                 LEFT JOIN user_achievements ua ON u.id = ua.user_id 
                 WHERE ua.completed_at IS NOT NULL 
                 GROUP BY u.id 
                 ORDER BY count DESC 
                 LIMIT $1`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid category' });
    }

    const result = await db.query(query, [limit]);
    res.json(result.rows);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's recent transactions
router.get('/user/:discordId/transactions', async (req, res) => {
  try {
    const { discordId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    if (discordId !== req.user.id && req.user.id !== process.env.ADMIN_USER_ID) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await db.query(
      `SELECT t.* FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE u.discord_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2`,
      [discordId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get achievements progress
router.get('/user/:discordId/achievements', async (req, res) => {
  try {
    const { discordId } = req.params;

    if (discordId !== req.user.id && req.user.id !== process.env.ADMIN_USER_ID) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const userResult = await userService.getOrCreateUser(discordId, req.user.username);
    
    if (!userResult.success) {
      return res.status(404).json({ error: 'User not found' });
    }

    const achievementService = require('../../services/achievementService');
    const achResult = await achievementService.getUserAchievements(userResult.user.id);

    if (!achResult.success) {
      return res.status(500).json({ error: 'Error loading achievements' });
    }

    res.json(achResult.achievements);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get all users (paginated)
router.get('/admin/users', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await db.query(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) FROM users');
    const totalUsers = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Award currency/XP to user
router.post('/admin/award', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const { discordId, currency, xp, reason } = req.body;

    if (!discordId || (!currency && !xp)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const userResult = await userService.getUser(discordId);
    
    if (!userResult.success) {
      return res.status(404).json({ error: 'User not found' });
    }

    const results = {};

    if (currency) {
      const currencyService = require('../../services/currencyService');
      results.currency = await currencyService.awardCurrency(
        userResult.user.id,
        currency,
        'admin',
        reason || 'Admin award'
      );
    }

    if (xp) {
      const xpService = require('../../services/xpService');
      results.xp = await xpService.awardXP(
        userResult.user.id,
        xp,
        'admin'
      );
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;