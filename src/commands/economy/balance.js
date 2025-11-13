const userService = require('../../services/userService');
const config = require('../../config/config');

module.exports = {
  name: 'balance',
  aliases: ['bal', 'money', 'coins'],
  description: 'Check your currency and XP balance',
  usage: '!balance [@user]',
  category: 'economy',
  
  async execute(message, args) {
    try {
      // Check mentioned user or self
      const targetUser = message.mentions.users.first() || message.author;
      
      // Get user from database
      const dbResult = await userService.getOrCreateUser(
        targetUser.id, 
        targetUser.username
      );

      if (!dbResult.success || !dbResult.user) {
        return message.reply('❌ User not found in database!');
      }

      const dbUser = dbResult.user; // <-- access the actual user object

      // Safely default currency values to 0
      const currency = dbUser.currency ?? 0;
      const premiumCurrency = dbUser.premium_currency ?? 0;

      // Calculate XP progress
      const currentLevel = dbUser.level ?? 1;
      const currentXP = dbUser.xp ?? 0;
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

      const embed = {
        color: config.colors.primary,
        title: `💰 ${targetUser.username}'s Balance`,
        thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) },
        fields: [
          {
            name: '🪙 Currency',
            value: `**${currency.toLocaleString()}** coins`,
            inline: true
          },
          {
            name: '💎 Premium Currency',
            value: `**${premiumCurrency.toLocaleString()}** gems`,
            inline: true
          },
          {
            name: '\u200b',
            value: '\u200b',
            inline: true
          },
          {
            name: `⭐ Level ${currentLevel}`,
            value: `${xpProgress.toLocaleString()} / ${xpNeeded.toLocaleString()} XP\n${progressBar} ${progressPercent}%`,
            inline: false
          }
        ],
        footer: { text: 'Earn currency by chatting! Use !daily for bonus.' },
        timestamp: new Date()
      };

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in balance command:', error);
      message.reply('❌ Error fetching balance. Please try again!');
    }
  }
};
