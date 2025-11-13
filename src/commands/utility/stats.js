const config = require('../../config/config');
const userService = require('../../services/userService');

module.exports = {
  name: 'stats',
  description: 'View your profile statistics',
  usage: '!stats',
  category: 'utility',
  
  async execute(message, args, client) {
    try {
      // Get or create user
      const userResult = await userService.getOrCreateUser(
        message.author.id,
        message.author.username
      );
      
      if (!userResult.success) {
        return message.reply('❌ Error loading your profile!');
      }
      
      // If new user, show welcome message
      if (userResult.isNew) {
        return message.reply(
          '👋 **Welcome to Babaloo Bot!**\n\n' +
          'Your profile has been created!\n' +
          '🪙 You start with **0 coins**\n' +
          '⭐ You start at **Level 1**\n\n' +
          'Start chatting to earn currency and XP!\n' +
          'Use `!help` to see all commands.'
        );
      }
      
      // Get detailed stats
      const statsResult = await userService.getUserStats(message.author.id);
      
      if (!statsResult.success) {
        return message.reply('❌ Error loading stats!');
      }
      
      const stats = statsResult.stats;
      
      // Calculate level progress
      const currentLevel = stats.level;
      const currentXP = stats.xp;
      const xpForCurrent = (currentLevel - 1) ** 2 * 100;
      const xpForNext = currentLevel ** 2 * 100;
      const xpProgress = currentXP - xpForCurrent;
      const xpNeeded = xpForNext - xpForCurrent;
      const progressPercent = Math.round((xpProgress / xpNeeded) * 100);
      
      // Create progress bar
      const barLength = 10;
      const filledBars = Math.round((progressPercent / 100) * barLength);
      const emptyBars = barLength - filledBars;
      const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
      
      // Calculate days since joining
      const daysSince = Math.floor(
        (Date.now() - new Date(stats.created_at)) / (1000 * 60 * 60 * 24)
      );
      
      const embed = {
        color: config.colors.primary,
        title: `📊 ${stats.username}'s Stats`,
        thumbnail: {
          url: message.author.displayAvatarURL({ dynamic: true })
        },
        fields: [
          {
            name: '💰 Currency',
            value: `🪙 ${stats.currency.toLocaleString()} coins\n💎 ${stats.premium_currency} gems`,
            inline: true
          },
          {
            name: '⭐ Level',
            value: `Level ${currentLevel}\n${xpProgress.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`,
            inline: true
          },
          {
            name: '\u200b',
            value: '\u200b',
            inline: true
          },
          {
            name: 'Progress to Next Level',
            value: `${progressBar} ${progressPercent}%`,
            inline: false
          },
          {
            name: '🏆 Achievements',
            value: `${stats.achievements_completed} completed`,
            inline: true
          },
          {
            name: '📅 Member Since',
            value: `${daysSince} days ago`,
            inline: true
          },
          {
            name: '💸 Transactions',
            value: `${stats.total_transactions} total`,
            inline: true
          }
        ],
        footer: {
          text: 'Keep chatting to earn more currency and XP!'
        },
        timestamp: new Date()
      };
      
      message.reply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in stats command:', error);
      message.reply('❌ An error occurred while loading your stats!');
    }
  }
};