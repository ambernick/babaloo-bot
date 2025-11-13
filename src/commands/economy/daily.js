const userService = require('../../services/userService');
const config = require('../../config/config');

module.exports = {
  name: 'daily',
  description: 'Claim your daily bonus (once per 24 hours)',
  usage: '!daily',
  category: 'economy',
  
  async execute(message, args) {
    try {
      // Get user
      const dbUser = await userService.getOrCreateUser(
        message.author.id,
        message.author.username
      );

      // Attempt to claim daily
      const result = await userService.claimDaily(dbUser.id);

      if (!result.success) {
        return message.reply(`⏰ ${result.message}`);
      }

      // Success!
      const embed = {
        color: config.colors.success,
        title: '🎁 Daily Bonus Claimed!',
        description: result.message,
        fields: [
          {
            name: 'Rewards',
            value: `🪙 **+${result.currency}** currency\n⭐ **+${result.xp}** XP`,
            inline: false
          },
          {
            name: 'Come back in 24 hours!',
            value: 'Daily bonuses reset every day. Don\'t miss out!',
            inline: false
          }
        ],
        thumbnail: { url: message.author.displayAvatarURL({ dynamic: true }) },
        timestamp: new Date()
      };

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in daily command:', error);
      message.reply('❌ Error claiming daily bonus. Please try again!');
    }
  }
};