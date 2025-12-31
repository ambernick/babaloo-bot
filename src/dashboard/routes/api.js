// src/dashboard/routes/api.js
const express = require('express');
const router = express.Router();
const userService = require('../../services/userService');
const db = require('../../database/connection');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'icon-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadMiddleware = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

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
    const { unlinkTwitch } = req.body;

    // Reset all users to defaults
    if (unlinkTwitch) {
      // Reset stats AND unlink Twitch accounts
      await db.query(`
        UPDATE users
        SET currency = 0,
            premium_currency = 0,
            xp = 0,
            level = 1,
            twitch_id = NULL
      `);
    } else {
      // Reset stats only, keep Twitch links
      await db.query(`
        UPDATE users
        SET currency = 0,
            premium_currency = 0,
            xp = 0,
            level = 1
      `);
    }

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
      message: 'All stats have been reset successfully',
      twitchUnlinked: !!unlinkTwitch
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SHOP MANAGEMENT ROUTES ====================

const shopService = require('../../services/shopService');

// Get all shop items (admin)
router.get('/admin/shop/items', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM shop_items
      ORDER BY category, cost ASC
    `);

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching shop items:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create shop item (admin)
router.post('/admin/shop/items', async (req, res) => {
  try {
    const {
      name, description, cost, currency_type, category,
      icon_url, stock, enabled, cooldown_minutes, global_cooldown_minutes,
      requires_input, input_prompt, auto_fulfill
    } = req.body;

    const result = await db.query(`
      INSERT INTO shop_items
      (name, description, cost, currency_type, category, icon_url, stock,
       enabled, cooldown_minutes, global_cooldown_minutes, requires_input,
       input_prompt, auto_fulfill)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      name, description || null, cost, currency_type || 'regular',
      category || 'other', icon_url || null, stock || -1,
      enabled !== false, cooldown_minutes || 0, global_cooldown_minutes || 0,
      requires_input || false, input_prompt || null, auto_fulfill || false
    ]);

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('Error creating shop item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update shop item (admin)
router.put('/admin/shop/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, cost, currency_type, category,
      icon_url, stock, enabled, cooldown_minutes, global_cooldown_minutes,
      requires_input, input_prompt, auto_fulfill
    } = req.body;

    const result = await db.query(`
      UPDATE shop_items
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          cost = COALESCE($3, cost),
          currency_type = COALESCE($4, currency_type),
          category = COALESCE($5, category),
          icon_url = COALESCE($6, icon_url),
          stock = COALESCE($7, stock),
          enabled = COALESCE($8, enabled),
          cooldown_minutes = COALESCE($9, cooldown_minutes),
          global_cooldown_minutes = COALESCE($10, global_cooldown_minutes),
          requires_input = COALESCE($11, requires_input),
          input_prompt = COALESCE($12, input_prompt),
          auto_fulfill = COALESCE($13, auto_fulfill)
      WHERE id = $14
      RETURNING *
    `, [
      name, description, cost, currency_type, category, icon_url, stock,
      enabled, cooldown_minutes, global_cooldown_minutes,
      requires_input, input_prompt, auto_fulfill, id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('Error updating shop item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete shop item (admin)
router.delete('/admin/shop/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM shop_items WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting shop item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get pending redemptions (admin)
router.get('/admin/shop/redemptions/pending', async (req, res) => {
  try {
    const result = await shopService.getPendingRedemptions();

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ redemptions: result.redemptions });
  } catch (error) {
    console.error('Error fetching pending redemptions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all redemptions (admin)
router.get('/admin/shop/redemptions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const status = req.query.status; // optional filter

    let query = `
      SELECT
        r.id,
        r.cost,
        r.currency_type,
        r.status,
        r.user_input,
        r.created_at,
        r.fulfilled_at,
        r.notes,
        u.discord_id,
        u.twitch_id,
        u.username,
        si.name as item_name,
        si.description as item_description
      FROM redemptions r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN shop_items si ON r.shop_item_id = si.id
    `;

    const params = [];

    if (status) {
      query += ' WHERE r.status = $1';
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await db.query(query, params);

    res.json({ redemptions: result.rows });
  } catch (error) {
    console.error('Error fetching redemptions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fulfill redemption (admin)
router.post('/admin/shop/redemptions/:id/fulfill', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Get admin user ID from Discord ID
    const adminResult = await db.query(
      'SELECT id FROM users WHERE discord_id = $1',
      [req.user.id]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    const adminUserId = adminResult.rows[0].id;
    const result = await shopService.fulfillRedemption(id, adminUserId, notes);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, redemption: result.redemption });
  } catch (error) {
    console.error('Error fulfilling redemption:', error);
    res.status(500).json({ error: error.message });
  }
});

// Refund redemption (admin)
router.post('/admin/shop/redemptions/:id/refund', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get admin user ID from Discord ID
    const adminResult = await db.query(
      'SELECT id FROM users WHERE discord_id = $1',
      [req.user.id]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    const adminUserId = adminResult.rows[0].id;
    const result = await shopService.refundRedemption(id, adminUserId, reason);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: result.message });
  } catch (error) {
    console.error('Error refunding redemption:', error);
    res.status(500).json({ error: error.message });
  }
});

// Shop Admin Endpoints

/**
 * GET /api/admin/shop
 * Get all shop items (including disabled ones)
 */
router.get('/admin/shop', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const result = await db.query(`
      SELECT * FROM shop_items
      ORDER BY category, cost ASC
    `);

    res.json({ success: true, items: result.rows });
  } catch (error) {
    console.error('Error getting shop items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/shop
 * Create a new shop item
 */
router.post('/admin/shop', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const {
      name,
      description,
      cost,
      currency_type,
      category,
      icon_url,
      stock,
      enabled,
      cooldown_minutes,
      requires_input,
      input_prompt,
      auto_fulfill
    } = req.body;

    const result = await db.query(`
      INSERT INTO shop_items (
        name, description, cost, currency_type, category, icon_url,
        stock, enabled, cooldown_minutes, requires_input, input_prompt, auto_fulfill
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      name, description, cost, currency_type, category, icon_url,
      stock, enabled, cooldown_minutes, requires_input, input_prompt, auto_fulfill
    ]);

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('Error creating shop item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/shop/:id
 * Update a shop item
 */
router.put('/admin/shop/:id', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const { id } = req.params;
    const {
      name,
      description,
      cost,
      currency_type,
      category,
      icon_url,
      stock,
      enabled,
      cooldown_minutes,
      requires_input,
      input_prompt,
      auto_fulfill
    } = req.body;

    const result = await db.query(`
      UPDATE shop_items
      SET name = $1, description = $2, cost = $3, currency_type = $4,
          category = $5, icon_url = $6, stock = $7, enabled = $8,
          cooldown_minutes = $9, requires_input = $10, input_prompt = $11,
          auto_fulfill = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `, [
      name, description, cost, currency_type, category, icon_url,
      stock, enabled, cooldown_minutes, requires_input, input_prompt,
      auto_fulfill, id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('Error updating shop item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/shop/:id
 * Delete a shop item
 */
router.delete('/admin/shop/:id', async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM shop_items WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting shop item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/upload-icon
 * Upload an icon image for shop items
 */
router.post('/admin/upload-icon', uploadMiddleware.single('icon'), async (req, res) => {
  if (req.user.id !== process.env.ADMIN_USER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Return the URL path to the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
  } catch (error) {
    console.error('Error uploading icon:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;