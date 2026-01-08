// src/services/settingsService.js
const db = require('../database/connection');

class SettingsService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // Cache for 5 minutes
    this.lastCacheUpdate = null;
  }

  /**
   * Get a setting value by key
   */
  async getSetting(key, defaultValue = null) {
    try {
      // Check cache first
      if (this.isCacheValid() && this.cache.has(key)) {
        return this.cache.get(key);
      }

      // Fetch from database
      const result = await db.query(
        'SELECT value FROM bot_settings WHERE key = $1',
        [key]
      );

      if (result.rows.length === 0) {
        return defaultValue;
      }

      const value = this.parseValue(result.rows[0].value);
      this.cache.set(key, value);
      return value;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Get multiple settings at once
   */
  async getSettings(keys) {
    try {
      // Check if we need to refresh cache
      if (!this.isCacheValid()) {
        await this.refreshCache();
      }

      const settings = {};
      for (const key of keys) {
        settings[key] = this.cache.get(key) || null;
      }
      return settings;
    } catch (error) {
      console.error('Error getting settings:', error);
      return {};
    }
  }

  /**
   * Get all settings in a category
   */
  async getSettingsByCategory(category) {
    try {
      const result = await db.query(
        'SELECT key, value FROM bot_settings WHERE category = $1',
        [category]
      );

      const settings = {};
      for (const row of result.rows) {
        settings[row.key] = this.parseValue(row.value);
        this.cache.set(row.key, settings[row.key]);
      }

      return settings;
    } catch (error) {
      console.error(`Error getting settings for category ${category}:`, error);
      return {};
    }
  }

  /**
   * Refresh the entire settings cache
   */
  async refreshCache() {
    try {
      const result = await db.query('SELECT key, value FROM bot_settings');

      this.cache.clear();
      for (const row of result.rows) {
        this.cache.set(row.key, this.parseValue(row.value));
      }

      this.lastCacheUpdate = Date.now();
    } catch (error) {
      console.error('Error refreshing settings cache:', error);
    }
  }

  /**
   * Set a setting value
   */
  async setSetting(key, value) {
    try {
      await db.query(
        `UPDATE bot_settings
         SET value = $1, updated_at = CURRENT_TIMESTAMP
         WHERE key = $2`,
        [value, key]
      );

      // Invalidate cache
      this.invalidateCache();

      return { success: true };
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Invalidate cache (call this when settings are updated)
   */
  invalidateCache() {
    this.lastCacheUpdate = null;
    this.cache.clear();
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid() {
    if (!this.lastCacheUpdate) return false;
    return (Date.now() - this.lastCacheUpdate) < this.cacheExpiry;
  }

  /**
   * Parse setting value (convert string to appropriate type)
   */
  parseValue(value) {
    // Try to parse as boolean first
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Check if it looks like a Discord ID (only digits and length > 15)
    // Discord IDs are snowflakes that are too large for JavaScript numbers
    if (/^\d+$/.test(value) && value.length > 15) {
      return value; // Keep as string
    }

    // Try to parse as number (for config values like XP amounts)
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') {
      return num;
    }

    // Return as string
    return value;
  }
}

module.exports = new SettingsService();
