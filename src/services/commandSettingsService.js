// src/services/commandSettingsService.js
const db = require('../database/connection');

class CommandSettingsService {
  /**
   * Check if a command can be executed in a specific channel
   */
  async canExecuteCommand(commandName, channelId, userId) {
    try {
      // Get command settings
      const result = await db.query(
        'SELECT * FROM command_settings WHERE command_name = $1',
        [commandName]
      );

      // If no settings exist, command is allowed by default
      if (result.rows.length === 0) {
        return { allowed: true };
      }

      const settings = result.rows[0];

      // Check if command is globally disabled
      if (!settings.enabled) {
        return {
          allowed: false,
          reason: 'This command is currently disabled.'
        };
      }

      // Check if admin-only command
      if (settings.admin_only && userId !== process.env.ADMIN_USER_ID) {
        return {
          allowed: false,
          reason: 'This command is admin-only.'
        };
      }

      // Check channel whitelist/blacklist
      if (settings.use_whitelist) {
        // Whitelist mode: only allowed in specified channels
        if (!settings.allowed_channel_ids || settings.allowed_channel_ids.length === 0) {
          return { allowed: true }; // No whitelist = allow everywhere
        }

        if (!settings.allowed_channel_ids.includes(channelId)) {
          return {
            allowed: false,
            reason: 'This command cannot be used in this channel.'
          };
        }
      } else {
        // Blacklist mode: blocked in specified channels
        if (settings.blocked_channel_ids && settings.blocked_channel_ids.includes(channelId)) {
          return {
            allowed: false,
            reason: 'This command is blocked in this channel.'
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking command permissions:', error);
      // On error, allow the command to prevent blocking all commands
      return { allowed: true };
    }
  }

  /**
   * Get command settings
   */
  async getCommandSettings(commandName) {
    try {
      const result = await db.query(
        'SELECT * FROM command_settings WHERE command_name = $1',
        [commandName]
      );

      return {
        success: true,
        settings: result.rows[0] || null
      };
    } catch (error) {
      console.error('Error getting command settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all command settings
   */
  async getAllCommandSettings() {
    try {
      const result = await db.query(
        'SELECT * FROM command_settings ORDER BY command_name'
      );

      return { success: true, settings: result.rows };
    } catch (error) {
      console.error('Error getting all command settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update or create command settings
   */
  async updateCommandSettings(commandName, settings) {
    try {
      const {
        enabled,
        allowed_channel_ids,
        use_whitelist,
        blocked_channel_ids,
        admin_only
      } = settings;

      const result = await db.query(
        `INSERT INTO command_settings
         (command_name, enabled, allowed_channel_ids, use_whitelist, blocked_channel_ids, admin_only)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (command_name)
         DO UPDATE SET
           enabled = COALESCE($2, command_settings.enabled),
           allowed_channel_ids = CASE WHEN $3 IS NOT NULL THEN $3 ELSE command_settings.allowed_channel_ids END,
           use_whitelist = COALESCE($4, command_settings.use_whitelist),
           blocked_channel_ids = CASE WHEN $5 IS NOT NULL THEN $5 ELSE command_settings.blocked_channel_ids END,
           admin_only = COALESCE($6, command_settings.admin_only)
         RETURNING *`,
        [
          commandName,
          enabled,
          allowed_channel_ids,
          use_whitelist,
          blocked_channel_ids,
          admin_only
        ]
      );

      return { success: true, settings: result.rows[0] };
    } catch (error) {
      console.error('Error updating command settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enable a command globally
   */
  async enableCommand(commandName) {
    return this.updateCommandSettings(commandName, { enabled: true });
  }

  /**
   * Disable a command globally
   */
  async disableCommand(commandName) {
    return this.updateCommandSettings(commandName, { enabled: false });
  }

  /**
   * Add channel to whitelist
   */
  async addToWhitelist(commandName, channelId) {
    try {
      const settings = await this.getCommandSettings(commandName);
      const currentChannels = settings.settings?.allowed_channel_ids || [];

      if (!currentChannels.includes(channelId)) {
        currentChannels.push(channelId);
      }

      return this.updateCommandSettings(commandName, {
        allowed_channel_ids: currentChannels,
        use_whitelist: true
      });
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove channel from whitelist
   */
  async removeFromWhitelist(commandName, channelId) {
    try {
      const settings = await this.getCommandSettings(commandName);
      const currentChannels = settings.settings?.allowed_channel_ids || [];

      const updatedChannels = currentChannels.filter(id => id !== channelId);

      return this.updateCommandSettings(commandName, {
        allowed_channel_ids: updatedChannels
      });
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add channel to blacklist
   */
  async addToBlacklist(commandName, channelId) {
    try {
      const settings = await this.getCommandSettings(commandName);
      const currentChannels = settings.settings?.blocked_channel_ids || [];

      if (!currentChannels.includes(channelId)) {
        currentChannels.push(channelId);
      }

      return this.updateCommandSettings(commandName, {
        blocked_channel_ids: currentChannels,
        use_whitelist: false
      });
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove channel from blacklist
   */
  async removeFromBlacklist(commandName, channelId) {
    try {
      const settings = await this.getCommandSettings(commandName);
      const currentChannels = settings.settings?.blocked_channel_ids || [];

      const updatedChannels = currentChannels.filter(id => id !== channelId);

      return this.updateCommandSettings(commandName, {
        blocked_channel_ids: updatedChannels
      });
    } catch (error) {
      console.error('Error removing from blacklist:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete command settings (reset to default)
   */
  async deleteCommandSettings(commandName) {
    try {
      await db.query(
        'DELETE FROM command_settings WHERE command_name = $1',
        [commandName]
      );

      return { success: true };
    } catch (error) {
      console.error('Error deleting command settings:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CommandSettingsService();