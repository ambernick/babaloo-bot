const userService = require('../../services/userService');
const xpService = require('../../services/xpService');
const db = require('../../database/connection');
const config = require('../../config/config');

module.exports = {
  name: 'rank',
  aliases: ['level', 'xp'],
  description: 'Check your level and rank',
  usage: '!rank [@user]',
  category: 'economy',
  
  async execute(message, args, client) {
    try {
      const targetUser = message.mentions.users.first() || message.author;
      
      const userResult = await userService.getOrCreateUser(
        targetUser.id,
        targetUser.username
      );

      if (!userResult.success) {
        return message.reply('❌ User not found!');
      }

      const user = userResult.user;

      // Get user's rank by XP
      const rankResult = await db.query(
        `SELECT COUNT(*) + 1 as rank 
         FROM users 
         WHERE xp > $1`,
        [user.xp]
      );
      const rank = rankResult.rows[0].rank;

      // Get total users
      const totalResult = await db.query('SELECT COUNT(*) as total FROM users');
      const totalUsers = totalResult.rows[0].total;

      // Get level progress
      const progress = xpService.getLevelProgress(user.xp, user.level);

      // Create visual progress bar
      const barLength = 20;
      const filledBars = Math.round((progress.progressPercent / 100) * barLength);
      const emptyBars = barLength - filledBars;
      const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

      const embed = {
        color: config.colors.info,
        title: `⭐ ${targetUser.username}'s Rank`,
        thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) },
        description: `**Rank #${rank}** out of ${totalUsers} users`,
        fields: [
          {
            name: `Level ${user.level}`,
            value: `Total XP: **${user.xp.toLocaleString()}**`,
            inline: false
          },
          {
            name: `Progress to Level ${user.level + 1}`,
            value: `${progressBar}\n${progress.xpProgress.toLocaleString()} / ${progress.xpNeeded.toLocaleString()} XP (${progress.progressPercent}%)`,
            inline: false
          },
          {
            name: '💡 How to Level Up',
            value: 'Chat in Discord • Complete achievements • Claim daily bonus',
            inline: false
          }
        ],
        timestamp: new Date()
      };

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in rank command:', error);
      message.reply('❌ Error fetching rank. Please try again!');
    }
  }
};