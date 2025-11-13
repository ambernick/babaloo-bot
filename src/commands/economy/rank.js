const userService = require('../../services/userService');
const config = require('../../config/config');

module.exports = {
  name: 'rank',
  aliases: ['level', 'lvl'],
  description: 'Check your level and XP rank',
  usage: '!rank [@user]',
  category: 'economy',

  async execute(message, args) {
    try {
      // Target user: mention or self
      const targetUser = message.mentions.users.first() || message.author;

      // Fetch user from database
      const dbResult = await userService.getOrCreateUser(
        targetUser.id,
        targetUser.username
      );

      if (!dbResult.success || !dbResult.user) {
        return message.reply('❌ User not found in database!');
      }

      const dbUser = dbResult.user;

      // Safe defaults
      const currentLevel = dbUser.level ?? 1;
      const currentXP = dbUser.xp ?? 0;

      // XP calculations
      const xpForCurrent = (currentLevel - 1) ** 2 * 100;
      const xpForNext = currentLevel ** 2 * 100;
      const xpProgress = currentXP - xpForCurrent;
      const xpNeeded = xpForNext - xpForCurrent;
      const progressPercent = Math.round((xpProgress / xpNeeded) * 100);

      // Progress bar
      const barLength = 10;
      const filledBars = Math.round((progressPercent / 100) * barLength);
      const emptyBars = barLength - filledBars;
      const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

      const embed = {
        color: config.colors.primary,
        title: `⭐ ${targetUser.username}'s Rank`,
        thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) },
        fields: [
          {
            name: 'Level',
            value: `${currentLevel}`,
            inline: true
          },
          {
            name: 'XP',
            value: `${xpProgress.toLocaleString()} / ${xpNeeded.toLocaleString()} XP\n${progressBar} ${progressPercent}%`,
            inline: false
          },
          {
            name: 'Currency',
            value: `🪙 ${ (dbUser.currency ?? 0).toLocaleString() } coins`,
            inline: true
          },
          {
            name: 'Premium Currency',
            value: `💎 ${ (dbUser.premium_currency ?? 0).toLocaleString() } gems`,
            inline: true
          }
        ],
        footer: { text: 'Keep chatting to earn XP and coins!' },
        timestamp: new Date()
      };

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in rank command:', error);
      message.reply('❌ Error fetching rank. Please try again!');
    }
  }
};
