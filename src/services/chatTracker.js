const userService = require('./userService');

class ChatTracker {
  constructor() {
    // Track last message time per user (prevent spam)
    this.lastMessageTime = new Map();
    // Track messages this hour (rate limiting)
    this.messagesThisHour = new Map();
  }

  async handleMessage(message) {
    // Ignore bots
    if (message.author.bot) return;

    const userId = message.author.id;
    const username = message.author.username;
    const now = Date.now();

    // Get or create user
    const user = await userService.getOrCreateUser(userId, username);

    // Rate limiting: Max 1 earn per minute
    const lastTime = this.lastMessageTime.get(userId) || 0;
    const timeSinceLastEarn = (now - lastTime) / 1000 / 60; // minutes

    if (timeSinceLastEarn < 1) {
      return; // Too soon, no reward
    }

    // Hourly cap: Max 60 currency per hour
    const hourKey = `${userId}-${new Date().getHours()}`;
    const earnedThisHour = this.messagesThisHour.get(hourKey) || 0;

    if (earnedThisHour >= 60) {
      return; // Hit hourly cap
    }

    // Award currency and XP
    const currencyEarned = 1; // 1 per minute of chatting
    const xpEarned = 2; // 2 XP per message

    await userService.awardCurrency(user.id, currencyEarned, 'chat', 'Chatting');
    const result = await userService.awardXP(user.id, xpEarned, 'chat');

    // Update tracking
    this.lastMessageTime.set(userId, now);
    this.messagesThisHour.set(hourKey, earnedThisHour + currencyEarned);

    // If leveled up, announce!
    if (result.leveledUp) {
      message.channel.send(
        `🎉 **${username}** just leveled up! **Level ${result.oldLevel} → ${result.newLevel}**`
      );
    }

    // Clean up old hourly data every hour
    if (Math.random() < 0.01) { // 1% chance per message
      this.cleanupHourlyData();
    }
  }

  cleanupHourlyData() {
    const currentHour = new Date().getHours();
    for (const [key, value] of this.messagesThisHour.entries()) {
      const keyHour = parseInt(key.split('-')[1]);
      if (keyHour !== currentHour) {
        this.messagesThisHour.delete(key);
      }
    }
  }

  // Reset hourly tracking (call this every hour via cron)
  resetHourlyLimits() {
    this.messagesThisHour.clear();
    console.log('✅ Hourly earning limits reset');
  }
}

module.exports = new ChatTracker();