// src/services/chatTracker.js
const userService = require('./userService');
const currencyService = require('./currencyService');
const xpService = require('./xpService');
const levelUpHandler = require('../events/levelUp');
const settingsService = require('./settingsService');

class ChatTracker {
  constructor() {
    this.lastMessageTime = new Map();
    this.messagesThisHour = new Map();
  }

  async handleMessage(message) {
    if (message.author.bot) return;

    const userId = message.author.id;
    const username = message.author.username;
    const now = Date.now();

    try {
      const userResult = await userService.getOrCreateUser(userId, username);

      if (!userResult.success) {
        console.error('Error getting user:', userResult.error);
        return;
      }

      const user = userResult.user;

      // Check for pending achievement notifications first
      const achievementService = require('./achievementService');
      const pendingAchievements = await achievementService.getPendingNotifications(user.id);

      // Announce pending achievements if any
      if (pendingAchievements && pendingAchievements.length > 0) {
        for (const ach of pendingAchievements) {
          await achievementService.announceAchievement(message.channel, message.author, ach, message.client);
        }
      }

      // Get settings from database
      const settings = await settingsService.getSettings([
        'discord_chat_xp',
        'discord_chat_currency',
        'chat_cooldown_seconds',
        'hourly_message_cap'
      ]);

      const currencyEarned = settings.discord_chat_currency || 1;
      const xpEarned = settings.discord_chat_xp || 2;
      const cooldownSeconds = settings.chat_cooldown_seconds || 60;
      const hourlyCap = settings.hourly_message_cap || 60;

      // Rate limiting: Cooldown check
      const lastTime = this.lastMessageTime.get(userId) || 0;
      const timeSinceLastEarn = (now - lastTime) / 1000;

      if (timeSinceLastEarn < cooldownSeconds) return;

      // Hourly cap check
      const hourKey = `${userId}-${new Date().getHours()}`;
      const earnedThisHour = this.messagesThisHour.get(hourKey) || 0;

      if (earnedThisHour >= hourlyCap) return;

      await currencyService.awardCurrency(user.id, currencyEarned, 'chat', 'Chatting');
      const xpResult = await xpService.awardXP(user.id, xpEarned, 'chat');

      // Update tracking
      this.lastMessageTime.set(userId, now);
      this.messagesThisHour.set(hourKey, earnedThisHour + currencyEarned);

      // Handle level-up with enhanced announcement
      if (xpResult.leveledUp) {
        const rewards = await levelUpHandler.announce(
          message.channel,
          message.author,
          xpResult.oldLevel,
          xpResult.newLevel,
          message.client
        );
        
        // Award level-up rewards
        await currencyService.awardCurrency(
          user.id,
          rewards.currencyReward,
          'level_up',
          `Level up to ${xpResult.newLevel}`
        );
        
        if (rewards.premiumReward > 0) {
          // Check if awardPremiumCurrency exists, if not skip
          if (typeof currencyService.awardPremiumCurrency === 'function') {
            await currencyService.awardPremiumCurrency(
              user.id,
              rewards.premiumReward,
              'level_up',
              `Level ${xpResult.newLevel} milestone`
            );
          }
        }
        
        // Auto-check achievements after level-up
        const achievementService = require('./achievementService');
        const newAchievements = await achievementService.autoCheckAchievements(user.id);
        
        // Announce any new achievements
        if (newAchievements && newAchievements.length > 0) {
          for (const ach of newAchievements) {
            await achievementService.announceAchievement(message.channel, message.author, ach, message.client);
          }
        }
      } else {
        // Still check achievements even without level-up (for message-count achievements)
        const achievementService = require('./achievementService');
        const newAchievements = await achievementService.autoCheckAchievements(user.id);

        // Only announce if there are new achievements
        if (newAchievements && newAchievements.length > 0) {
          for (const ach of newAchievements) {
            await achievementService.announceAchievement(message.channel, message.author, ach, message.client);
          }
        }
      }

      // Clean up old hourly data occasionally
      if (Math.random() < 0.01) {
        this.cleanupHourlyData();
      }
    } catch (error) {
      console.error('Error handling message for currency:', error);
    }
  }

  cleanupHourlyData() {
    const currentHour = new Date().getHours();
    for (const [key] of this.messagesThisHour.entries()) {
      const keyHour = parseInt(key.split('-')[1]);
      if (keyHour !== currentHour) {
        this.messagesThisHour.delete(key);
      }
    }
  }

  resetHourlyLimits() {
    this.messagesThisHour.clear();
    console.log('✅ Hourly earning limits reset');
  }
}

module.exports = new ChatTracker();