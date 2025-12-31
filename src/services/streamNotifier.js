// src/services/streamNotifier.js
const Logger = require('../utils/logger');
const settingsService = require('./settingsService');
const db = require('../database/connection');

class StreamNotifier {
  constructor() {
    this.liveStreams = new Map(); // Track live status for each streamer (username -> { isLive, lastStreamId })
    this.checkInterval = null;
    this.client = null;
  }

  /**
   * Start the stream notifier
   */
  async start(discordClient) {
    this.client = discordClient;

    // Get Twitch configuration
    const twitchClientId = process.env.TWITCH_CLIENT_ID;
    const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!twitchClientId || !twitchClientSecret) {
      Logger.warn('Stream notifications disabled: Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET');
      return false;
    }

    // Get access token
    try {
      await this.getAccessToken();

      // Check stream status every 60 seconds
      this.checkInterval = setInterval(() => {
        this.checkStreamStatus();
      }, 60000);

      // Initial check
      await this.checkStreamStatus();

      Logger.success('Stream notifier started');
      return true;
    } catch (error) {
      Logger.error('Failed to start stream notifier:', error);
      return false;
    }
  }

  /**
   * Stop the stream notifier
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    Logger.info('Stream notifier stopped');
  }

  /**
   * Get Twitch API access token
   */
  async getAccessToken() {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get Twitch access token: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;

    // Refresh token before it expires (expires in 60 days, refresh every 30 days)
    setTimeout(() => {
      this.getAccessToken();
    }, 30 * 24 * 60 * 60 * 1000);

    return this.accessToken;
  }

  /**
   * Get user IDs for multiple Twitch usernames
   */
  async getUserIds(usernames) {
    if (usernames.length === 0) {
      return {};
    }

    // Build query string for multiple usernames (max 100 per request)
    const params = usernames.map(u => `login=${encodeURIComponent(u)}`).join('&');
    const response = await fetch(`https://api.twitch.tv/helix/users?${params}`, {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user IDs: ${response.status}`);
    }

    const data = await response.json();

    // Map username -> user_id
    const userMap = {};
    data.data.forEach(user => {
      userMap[user.login.toLowerCase()] = user.id;
    });

    return userMap;
  }

  /**
   * Check if streams are currently live
   */
  async checkStreamStatus() {
    try {
      // Get all enabled stream notifiers from database
      const result = await db.query(`
        SELECT id, twitch_username, twitch_user_id, custom_message
        FROM stream_notifiers
        WHERE enabled = true
      `);

      const notifiers = result.rows;

      if (notifiers.length === 0) {
        return;
      }

      // Get user IDs for notifiers that don't have them cached
      const notifiersNeedingIds = notifiers.filter(n => !n.twitch_user_id);
      if (notifiersNeedingIds.length > 0) {
        const userIds = await this.getUserIds(notifiersNeedingIds.map(n => n.twitch_username));

        // Update database with fetched user IDs
        for (const notifier of notifiersNeedingIds) {
          const userId = userIds[notifier.twitch_username.toLowerCase()];
          if (userId) {
            await db.query(`
              UPDATE stream_notifiers
              SET twitch_user_id = $1
              WHERE id = $2
            `, [userId, notifier.id]);
            notifier.twitch_user_id = userId;
          }
        }
      }

      // Build query string for all user IDs (max 100 per request)
      const userIds = notifiers
        .filter(n => n.twitch_user_id)
        .map(n => `user_id=${n.twitch_user_id}`)
        .join('&');

      if (!userIds) {
        return;
      }

      const response = await fetch(`https://api.twitch.tv/helix/streams?${userIds}`, {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        // Token might be expired, try to refresh
        if (response.status === 401) {
          await this.getAccessToken();
          return;
        }
        throw new Error(`Failed to check stream status: ${response.status}`);
      }

      const data = await response.json();

      // Create map of currently live streams
      const liveStreamsById = new Map();
      data.data.forEach(stream => {
        liveStreamsById.set(stream.user_id, stream);
      });

      // Check each notifier
      for (const notifier of notifiers) {
        if (!notifier.twitch_user_id) continue;

        const username = notifier.twitch_username;
        const stream = liveStreamsById.get(notifier.twitch_user_id);
        const trackedStream = this.liveStreams.get(username) || { isLive: false, lastStreamId: null };

        if (stream) {
          // Stream is live
          if (!trackedStream.isLive || trackedStream.lastStreamId !== stream.id) {
            // Stream just went live or it's a new stream
            this.liveStreams.set(username, { isLive: true, lastStreamId: stream.id });
            await this.sendLiveNotification(stream, notifier);
          }
        } else {
          // Stream is offline
          if (trackedStream.isLive) {
            Logger.info(`Stream went offline: ${username}`);
          }
          this.liveStreams.set(username, { isLive: false, lastStreamId: null });
        }
      }
    } catch (error) {
      // If table doesn't exist, log once and disable checking
      if (error.code === '42P01') {
        Logger.warn('stream_notifiers table does not exist. Run migration script: node scripts/add-stream-notifier-table.js');
        // Stop the interval to prevent repeated errors
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
      } else {
        Logger.error('Error checking stream status:', error);
      }
    }
  }

  /**
   * Send live notification to Discord
   */
  async sendLiveNotification(stream, notifier) {
    try {
      // Get notification channel from settings
      const settings = await settingsService.getSettings([
        'stream_notification_channel_id',
        'stream_notification_message',
        'stream_notification_role_id'
      ]);

      const channelId = settings.stream_notification_channel_id;
      if (!channelId) {
        Logger.warn('Stream notification channel not configured');
        return;
      }

      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        Logger.error(`Stream notification channel not found: ${channelId}`);
        return;
      }

      const username = notifier.twitch_username;
      const roleId = settings.stream_notification_role_id;

      // Use custom message from notifier if available, otherwise use default from settings
      const customMessage = notifier.custom_message || settings.stream_notification_message || `@everyone 🔴 **{username} is now LIVE!**`;

      // Build notification message
      let message = customMessage;

      // Replace placeholders
      message = message
        .replace(/{username}/g, username)
        .replace(/{title}/g, stream.title)
        .replace(/{game}/g, stream.game_name || 'No category')
        .replace(/{url}/g, `https://twitch.tv/${username}`);

      // Add role mention if configured
      if (roleId && roleId !== 'everyone') {
        message = `<@&${roleId}> ${message}`;
      }

      // Create embed
      const embed = {
        color: 0x9147ff, // Twitch purple
        author: {
          name: `${username} is now live on Twitch!`,
          icon_url: stream.thumbnail_url ? stream.thumbnail_url.replace('{width}', '50').replace('{height}', '50') : undefined
        },
        title: stream.title,
        url: `https://twitch.tv/${username}`,
        description: stream.game_name ? `Playing **${stream.game_name}**` : undefined,
        thumbnail: {
          url: stream.thumbnail_url ? stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180') + `?t=${Date.now()}` : undefined
        },
        fields: [
          {
            name: '👥 Viewers',
            value: stream.viewer_count.toString(),
            inline: true
          }
        ],
        timestamp: new Date(stream.started_at).toISOString(),
        footer: {
          text: 'Stream started'
        }
      };

      await channel.send({
        content: message,
        embeds: [embed]
      });

      Logger.success(`Stream live notification sent for ${username}: ${stream.title}`);
    } catch (error) {
      Logger.error('Error sending live notification:', error);
    }
  }

  /**
   * Get current stream info for a specific username
   */
  async getStreamInfo(username) {
    try {
      // Get user ID for the username
      const userIds = await this.getUserIds([username]);
      const userId = userIds[username.toLowerCase()];

      if (!userId) {
        return { isLive: false, error: 'User not found' };
      }

      const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get stream info: ${response.status}`);
      }

      const data = await response.json();

      if (data.data.length > 0) {
        const stream = data.data[0];
        return {
          isLive: true,
          username: username,
          title: stream.title,
          game: stream.game_name,
          viewers: stream.viewer_count,
          startedAt: stream.started_at,
          thumbnailUrl: stream.thumbnail_url
        };
      }

      return {
        isLive: false,
        username: username
      };
    } catch (error) {
      Logger.error('Error getting stream info:', error);
      return { isLive: false, error: error.message };
    }
  }
}

module.exports = new StreamNotifier();
