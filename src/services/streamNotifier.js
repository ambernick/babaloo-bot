// src/services/streamNotifier.js
const Logger = require('../utils/logger');
const settingsService = require('./settingsService');

class StreamNotifier {
  constructor() {
    this.isLive = false;
    this.checkInterval = null;
    this.client = null;
    this.lastStreamId = null;
  }

  /**
   * Start the stream notifier
   */
  async start(discordClient) {
    this.client = discordClient;

    // Get Twitch configuration
    const twitchClientId = process.env.TWITCH_CLIENT_ID;
    const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;
    const broadcasterUsername = process.env.TWITCH_BROADCASTER_USERNAME;

    if (!twitchClientId || !twitchClientSecret || !broadcasterUsername) {
      Logger.warn('Stream notifications disabled: Missing TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, or TWITCH_BROADCASTER_USERNAME');
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
   * Get broadcaster user ID from username
   */
  async getBroadcasterId() {
    if (this.broadcasterId) {
      return this.broadcasterId;
    }

    const username = process.env.TWITCH_BROADCASTER_USERNAME;
    const response = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get broadcaster ID: ${response.status}`);
    }

    const data = await response.json();
    if (data.data.length === 0) {
      throw new Error(`Broadcaster not found: ${username}`);
    }

    this.broadcasterId = data.data[0].id;
    return this.broadcasterId;
  }

  /**
   * Check if stream is currently live
   */
  async checkStreamStatus() {
    try {
      const broadcasterId = await this.getBroadcasterId();

      const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`, {
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
      const wasLive = this.isLive;

      if (data.data.length > 0) {
        const stream = data.data[0];

        // Stream is live
        if (!wasLive || this.lastStreamId !== stream.id) {
          // Stream just went live or it's a new stream
          this.isLive = true;
          this.lastStreamId = stream.id;
          await this.sendLiveNotification(stream);
        }
      } else {
        // Stream is offline
        if (wasLive) {
          Logger.info('Stream went offline');
        }
        this.isLive = false;
        this.lastStreamId = null;
      }
    } catch (error) {
      Logger.error('Error checking stream status:', error);
    }
  }

  /**
   * Send live notification to Discord
   */
  async sendLiveNotification(stream) {
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

      const broadcasterUsername = process.env.TWITCH_BROADCASTER_USERNAME;
      const roleId = settings.stream_notification_role_id;
      const customMessage = settings.stream_notification_message || `@everyone 🔴 **${broadcasterUsername} is now LIVE!**`;

      // Build notification message
      let message = customMessage;

      // Replace placeholders
      message = message
        .replace('{username}', broadcasterUsername)
        .replace('{title}', stream.title)
        .replace('{game}', stream.game_name || 'No category')
        .replace('{url}', `https://twitch.tv/${broadcasterUsername}`);

      // Add role mention if configured
      if (roleId && roleId !== 'everyone') {
        message = `<@&${roleId}> ${message}`;
      }

      // Create embed
      const embed = {
        color: 0x9147ff, // Twitch purple
        author: {
          name: `${broadcasterUsername} is now live on Twitch!`,
          icon_url: stream.thumbnail_url ? stream.thumbnail_url.replace('{width}', '50').replace('{height}', '50') : undefined
        },
        title: stream.title,
        url: `https://twitch.tv/${broadcasterUsername}`,
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

      Logger.success(`Stream live notification sent: ${stream.title}`);
    } catch (error) {
      Logger.error('Error sending live notification:', error);
    }
  }

  /**
   * Get current stream info
   */
  async getStreamInfo() {
    try {
      const broadcasterId = await this.getBroadcasterId();

      const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`, {
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
          title: stream.title,
          game: stream.game_name,
          viewers: stream.viewer_count,
          startedAt: stream.started_at,
          thumbnailUrl: stream.thumbnail_url
        };
      }

      return {
        isLive: false
      };
    } catch (error) {
      Logger.error('Error getting stream info:', error);
      return { isLive: false, error: error.message };
    }
  }
}

module.exports = new StreamNotifier();
