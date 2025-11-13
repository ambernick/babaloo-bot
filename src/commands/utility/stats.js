const config = require('../../config/config');
const userService = require('../../services/userService');

module.exports = {
  name: 'stats',
  description: 'View your profile statistics or another user\'s stats',
  usage: '!stats [@user]',
  category: 'utility',

  async execute(message, args, client) {
    try {
      // 1️⃣ Determine target user: mentioned or self
      const targetUser = message.mentions.users.first() || message.author;

      // 2️⃣ Get or create user in DB
      const userResult = await userService.getOrCreateUser(
        targetUser.id,
        targetUser.username
      );

      if (!userResult.success) {
        return message.reply('❌ Error loading user profile!');
      }

      // Optional: show welcome message if new
      if (userResult.isNew && targetUser.id === message.author.id) {
        return message.reply(
          '👋 **Welcome to Babaloo Bot!**\n\n' +
          'Your profile has been created!\n' +
          '🪙 You start with **0 coins**\n' +
          '⭐ You start at **Level 1**\n\n' +
          'Start chatting to earn currency and XP!\n' +
          'Use `!help` to see all commands.'
        );
      }

      // 3️⃣ Get stats from DB
      const statsResult = await userService.getUserStats(targetUser.id);

      if (!statsResult.success) {
        return message.reply('❌ Error loading stats!');
      }

      const stats = statsResult.stats;

      // 4️⃣ Calculate level progress
      const currentLevel = stats.level;
      const currentXP = stats.xp;
      const xpForCurrent = (currentLevel - 1) ** 2 * 100;
      const xpForNext = currentLevel ** 2 * 100;
      const xpProgress = currentXP - xpForCurrent;
      const xpNeeded = xpForNext - xpForCurrent;
      const progressPercent = Math.round((xpProgress / xpNeeded) * 100);

      // 5️⃣ Create progress bar
      const barLength = 10;
      const filledBars = Math.round((progressPercent / 100) * barLength);
      const emptyBars = barLength - filledBars;
      const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

      // 6️⃣ Days since joining
      const daysSince = Math.floor(
        (Date.now() - new Date(stats.created_at)) / (1000 * 60 * 60 * 24)
      );

      // 7️⃣ Build embed
      const embed = {
        color: config.colors.primary,
        title: `📊 ${targetUser.username}'s Stats`,
        thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) },
        fields: [
          {
            name: '💰 Currency',
            value: `🪙 ${stats.currency?.toLocaleString() || 0} coins\n💎 ${stats.premium_currency || 0} gems`,
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
            value: `${stats.achievements_completed || 0} completed`,
            inline: true
          },
          {
            name: '📅 Member Since',
            value: `${daysSince} days ago`,
            inline: true
          },
          {
            name: '💸 Transactions',
            value: `${stats.total_transactions || 0} total`,
            inline: true
          }
        ],
        footer: { text: 'Keep chatting to earn more currency and XP!' },
        timestamp: new Date()
      };

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in stats command:', error);
      message.reply('❌ An error occurred while loading stats!');
    }
  }
};
