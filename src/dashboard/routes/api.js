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
    const { discordId, currency, premium, xp, reason } = req.body;

    if (!discordId || (!currency && !premium && !xp)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const userResult = await userService.getOrCreateUser(discordId, 'Unknown');

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

    if (premium) {
      // Award premium currency
      await db.query(
        'UPDATE users SET premium_currency = premium_currency + $1 WHERE id = $2',
        [premium, userResult.user.id]
      );
      results.premium = { success: true, amount: premium };
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

// Admin: Get all stats
router.get('/admin/stats/users', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const result = await db.query('SELECT COUNT(*) as count FROM users');
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/admin/stats/currency', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const result = await db.query('SELECT SUM(currency) as total FROM users');
    res.json({ total: parseInt(result.rows[0].total) || 0 });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/admin/stats/xp', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const result = await db.query('SELECT SUM(xp) as total FROM users');
    res.json({ total: parseInt(result.rows[0].total) || 0 });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/admin/stats/achievements', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const result = await db.query('SELECT COUNT(*) as count FROM user_achievements WHERE completed_at IS NOT NULL');
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/admin/stats/premium', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const result = await db.query('SELECT SUM(premium_currency) as total FROM users');
    res.json({ total: parseInt(result.rows[0].total) || 0 });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/admin/stats/transactions', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const result = await db.query('SELECT COUNT(*) as count FROM transactions');
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get all users with search and pagination
router.get('/admin/users', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = 'SELECT * FROM users';
    let countQuery = 'SELECT COUNT(*) FROM users';
    let params = [limit, offset];

    if (search) {
      query += ' WHERE username ILIKE $3 OR discord_id ILIKE $3';
      countQuery += ' WHERE username ILIKE $1 OR discord_id ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';

    const result = await db.query(query, params);
    const countResult = await db.query(countQuery, search ? [`%${search}%`] : []);
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

// Admin: Get recent transactions with user info
router.get('/admin/transactions', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const limit = parseInt(req.query.limit) || 50;

    const result = await db.query(
      `SELECT t.*, u.username, u.discord_id
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       ORDER BY t.created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Take currency/XP from user
router.post('/admin/take', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const { discordId, currency, premium, xp, reason } = req.body;

    if (!discordId || (!currency && !premium && !xp)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const userResult = await userService.getOrCreateUser(discordId, 'Unknown');

    if (!userResult.success) {
      return res.status(404).json({ error: 'User not found' });
    }

    const results = {};

    if (currency) {
      // Take currency (deduct)
      const currentBalance = await db.query(
        'SELECT currency FROM users WHERE id = $1',
        [userResult.user.id]
      );

      const newBalance = Math.max(0, currentBalance.rows[0].currency - currency);

      await db.query(
        'UPDATE users SET currency = $1 WHERE id = $2',
        [newBalance, userResult.user.id]
      );

      // Log transaction
      await db.query(
        `INSERT INTO transactions (user_id, type, category, amount, currency_type, description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userResult.user.id, 'spend', 'admin_take', currency, 'regular', reason || 'Admin took resources']
      );

      results.currency = { success: true, amount: currency, newBalance };
    }

    if (premium) {
      // Take premium currency (deduct)
      const currentBalance = await db.query(
        'SELECT premium_currency FROM users WHERE id = $1',
        [userResult.user.id]
      );

      const newBalance = Math.max(0, currentBalance.rows[0].premium_currency - premium);

      await db.query(
        'UPDATE users SET premium_currency = $1 WHERE id = $2',
        [newBalance, userResult.user.id]
      );

      results.premium = { success: true, amount: premium, newBalance };
    }

    if (xp) {
      // Take XP (deduct)
      const currentXP = await db.query(
        'SELECT xp FROM users WHERE id = $1',
        [userResult.user.id]
      );

      const newXP = Math.max(0, currentXP.rows[0].xp - xp);
      const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;

      await db.query(
        'UPDATE users SET xp = $1, level = $2 WHERE id = $3',
        [newXP, newLevel, userResult.user.id]
      );

      results.xp = { success: true, amount: xp, newXP, newLevel };
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Reset ALL stats (nuclear option)
router.post('/admin/reset-all', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    // Reset all users to defaults
    await db.query(`
      UPDATE users
      SET currency = 0,
          premium_currency = 0,
          xp = 0,
          level = 1
    `);

    // Delete all user achievements
    await db.query('DELETE FROM user_achievements');

    // Delete all transactions
    await db.query('DELETE FROM transactions');

    // Reset user profiles
    await db.query(`
      UPDATE user_profiles
      SET streak_days = 0
    `);

    res.json({
      success: true,
      message: 'All stats have been reset successfully'
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;