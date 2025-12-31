const tmi = require('tmi.js');
const Logger = require('../utils/logger');
const userService = require('./userService');
const currencyService = require('./currencyService');
const xpService = require('./xpService');
const settingsService = require('./settingsService');

class TwitchBot {
  constructor() {
    this.client = null;
    this.lastMessageTime = new Map(); // userId -> timestamp
    this.messagesThisHour = new Map(); // userId-hour -> count
    this.isConnected = false;
    this.discordClient = null; // Will be set during initialization for manual linking
  }

  async initialize(discordClient) {
    // Store Discord client for auto-linking
    this.discordClient = discordClient;

    // Skip if Twitch credentials not provided
    if (!process.env.TWITCH_BOT_USERNAME || !process.env.TWITCH_OAUTH_TOKEN) {
      Logger.info('Twitch bot credentials not configured, skipping Twitch integration');
      return false;
    }

    const channels = process.env.TWITCH_CHANNELS
      ? process.env.TWITCH_CHANNELS.split(',').map(ch => ch.trim())
      : [];

    if (channels.length === 0) {
      Logger.warn('No Twitch channels configured');
      return false;
    }

    // Create Twitch client
    this.client = new tmi.Client({
      options: { debug: process.env.NODE_ENV === 'development' },
      connection: {
        reconnect: true,
        secure: true
      },
      identity: {
        username: process.env.TWITCH_BOT_USERNAME,
        password: process.env.TWITCH_OAUTH_TOKEN // OAuth token (oauth:...)
      },
      channels
    });

    // Set up event handlers
    this.setupEventHandlers();

    try {
      await this.client.connect();
      this.isConnected = true;
      Logger.success(`Twitch bot connected to channels: ${channels.join(', ')}`);
      return true;
    } catch (error) {
      Logger.error('Failed to connect to Twitch:', error);
      return false;
    }
  }

  setupEventHandlers() {
    this.client.on('connected', (address, port) => {
      Logger.success(`Twitch bot connected to ${address}:${port}`);
    });

    this.client.on('disconnected', (reason) => {
      Logger.warn(`Twitch bot disconnected: ${reason}`);
      this.isConnected = false;
    });

    this.client.on('message', async (channel, tags, message, self) => {
      // Ignore bot's own messages
      if (self) return;

      // Handle commands (messages starting with !)
      if (message.startsWith('!')) {
        await this.handleCommand(channel, tags, message);
        return;
      }

      await this.handleMessage(channel, tags, message);
    });

    // Periodically clean up tracking maps
    setInterval(() => this.cleanupTracking(), 3600000); // Every hour
  }

  async handleCommand(channel, tags, message) {
    const twitchUserId = tags['user-id'];
    const username = tags['display-name'] || tags['username'];
    const parts = message.trim().split(' ');
    const command = parts[0].toLowerCase();

    try {
      switch (command) {
        case '!balance':
          await this.handleBalanceCommand(channel, twitchUserId, username);
          break;
        // Add more commands here in the future
        default:
          // Ignore unknown commands
          break;
      }
    } catch (error) {
      Logger.error(`Error handling Twitch command ${command} from ${username}:`, error);
    }
  }

  async handleBalanceCommand(channel, twitchUserId, username) {
    try {
      // Get or create user
      const userResult = await userService.getOrCreateUserByTwitch(twitchUserId, username);

      if (!userResult.success) {
        this.client.say(channel, `@${username} - Error fetching your balance. Please try again.`);
        return;
      }

      const user = userResult.user;
      const xpForNext = userService.xpForNextLevel(user.level);
      const xpProgress = user.xp - (user.level - 1) ** 2 * 100;

      const balanceMessage = `@${username} - Balance: ${user.currency} coins | Level ${user.level} (${xpProgress}/${xpForNext} XP)`;
      this.client.say(channel, balanceMessage);
      Logger.info(`Twitch balance command used by ${username}`);
    } catch (error) {
      Logger.error(`Error in handleBalanceCommand for ${username}:`, error);
      this.client.say(channel, `@${username} - Error fetching your balance. Please try again.`);
    }
  }

  async handleMessage(channel, tags) {
    const twitchUserId = tags['user-id'];
    const username = tags['display-name'] || tags['username'];
    const now = Date.now();

    try {
      // Auto-linking is not supported via bot API
      // Users must use /link-twitch command to manually link accounts

      // Get or create user by Twitch ID
      const userResult = await userService.getOrCreateUserByTwitch(twitchUserId, username);

      if (!userResult.success) {
        Logger.error(`Error getting Twitch user ${username}:`, userResult.error);
        return;
      }

      const user = userResult.user;

      // Get settings from database
      const settings = await settingsService.getSettings([
        'twitch_chat_xp',
        'twitch_chat_currency',
        'chat_cooldown_seconds',
        'hourly_message_cap'
      ]);

      const currencyEarned = settings.twitch_chat_currency || 1;
      const xpEarned = settings.twitch_chat_xp || 2;
      const cooldownSeconds = settings.chat_cooldown_seconds || 60;
      const hourlyCap = settings.hourly_message_cap || 60;

      // Rate limiting: Cooldown check
      const lastTime = this.lastMessageTime.get(twitchUserId) || 0;
      const timeSinceLastEarn = (now - lastTime) / 1000; // seconds

      if (timeSinceLastEarn < cooldownSeconds) return;

      // Hourly cap check
      const currentHour = new Date().getHours();
      const hourKey = `${twitchUserId}-${currentHour}`;
      const earnedThisHour = this.messagesThisHour.get(hourKey) || 0;

      if (earnedThisHour >= hourlyCap) return;

      await currencyService.awardCurrency(user.id, currencyEarned, 'twitch_chat', `Twitch: ${channel}`);
      const xpResult = await xpService.awardXP(user.id, xpEarned, 'twitch_chat');

      // Update tracking
      this.lastMessageTime.set(twitchUserId, now);
      this.messagesThisHour.set(hourKey, earnedThisHour + 1);

      // Handle level up
      if (xpResult.success && xpResult.leveledUp) {
        const levelUpMessage = `@${username} leveled up to Level ${xpResult.newLevel}! 🎉`;
        this.client.say(channel, levelUpMessage);
        Logger.info(`Twitch user ${username} leveled up to ${xpResult.newLevel}`);
      }

    } catch (error) {
      Logger.error(`Error handling Twitch message from ${username}:`, error);
    }
  }

  cleanupTracking() {
    const currentHour = new Date().getHours();

    // Clean up old hourly data
    for (const [key] of this.messagesThisHour.entries()) {
      const hour = parseInt(key.split('-')[1]);
      if (hour !== currentHour) {
        this.messagesThisHour.delete(key);
      }
    }

    Logger.info(`Twitch tracking cleanup: ${this.messagesThisHour.size} active hourly trackers`);
  }

  async say(channel, message) {
    if (!this.isConnected || !this.client) {
      Logger.warn('Twitch bot not connected, cannot send message');
      return false;
    }

    try {
      await this.client.say(channel, message);
      return true;
    } catch (error) {
      Logger.error('Error sending Twitch message:', error);
      return false;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      Logger.info('Twitch bot disconnected');
      this.isConnected = false;
    }
  }
}

// Export singleton
module.exports = new TwitchBot();
