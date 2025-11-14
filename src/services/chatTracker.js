// src/services/chatTracker.js
const userService = require('./userService');
const currencyService = require('./currencyService');
const xpService = require('./xpService');
const levelUpHandler = require('../events/levelUp');

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

      // Rate limiting: Max 1 earn per minute
      const lastTime = this.lastMessageTime.get(userId) || 0;
      const timeSinceLastEarn = (now - lastTime) / 1000 / 60;

      if (timeSinceLastEarn < 1) return;

      // Hourly cap: Max 60 currency per hour
      const hourKey = `${userId}-${new Date().getHours()}`;
      const earnedThisHour = this.messagesThisHour.get(hourKey) || 0;

      if (earnedThisHour >= 60) return;

      // Award currency and XP
      const currencyEarned = 1;
      const xpEarned = 2;

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
          xpResult.newLevel
        );
        
        // Award level-up rewards
        await currencyService.awardCurrency(
          user.id,
          rewards.currencyReward,
          'level_up',
          `Level up to ${xpResult.newLevel}`
        );
        
        if (rewards.premiumReward > 0) {
          await currencyService.awardPremiumCurrency(
            user.id,
            rewards.premiumReward,
            'level_up',
            `Level ${xpResult.newLevel} milestone`
          );
        }
        
        // Check for level-based achievements
        const achievementService = require('./achievementService');
        await achievementService.checkLevelAchievements(user.id, xpResult.newLevel);
      }

      // Auto-check achievements
      const achievementService = require('./achievementService');
      await achievementService.autoCheckAchievements(user.id);

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