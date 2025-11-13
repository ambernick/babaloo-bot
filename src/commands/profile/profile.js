const userService = require('../../services/userService');
const xpService = require('../../services/xpService');
const achievementService = require('../../services/achievementService');
const db = require('../../database/connection');
const config = require('../../config/config');

module.exports = {
  name: 'profile',
  aliases: ['me', 'prof'],
  description: 'View detailed user profile',
  usage: '!profile [@user]',
  category: 'profile',
  
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

      // Get detailed stats
      const statsResult = await db.query(
        `SELECT 
          u.*,
          COUNT(DISTINCT ua.id) FILTER (WHERE ua.completed_at IS NOT NULL) as achievements_completed,
          COUNT(DISTINCT t.id) as total_transactions,
          COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'earn'), 0) as total_earned,
          COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'spend'), 0) as total_spent
         FROM users u
         LEFT JOIN user_achievements ua ON u.id = ua.user_id
         LEFT JOIN transactions t ON u.id = t.user_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [user.id]
      );

      const stats = statsResult.rows[0];

      // Get rank
      const rankResult = await db.query(
        'SELECT COUNT(*) + 1 as rank FROM users WHERE xp > $1',
        [stats.xp]
      );
      const rank = rankResult.rows[0].rank;

      // Get level progress
      const progress = xpService.getLevelProgress(stats.xp, stats.level);
      const progressBar = createProgressBar(progress.progressPercent, 15);

      // Calculate days as member
      const daysSince = Math.floor(
        (Date.now() - new Date(stats.created_at)) / (1000 * 60 * 60 * 24)
      );

      // Get total achievements
      const achResult = await db.query('SELECT COUNT(*) as total FROM achievements');
      const totalAchievements = achResult.rows[0].total;

      const embed = {
        color: config.colors.primary,
        title: `👤 ${targetUser.username}'s Profile`,
        thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) },
        fields: [
          {
            name: '💰 Wealth',
            value: `🪙 ${stats.currency.toLocaleString()} coins\n💎 ${stats.premium_currency} gems`,
            inline: true
          },
          {
            name: '⭐ Level & Rank',
            value: `Level ${stats.level}\nRank #${rank}`,
            inline: true
          },
          {
            name: '🏆 Achievements',
            value: `${stats.achievements_completed} / ${totalAchievements}\n(${Math.round((stats.achievements_completed / totalAchievements) * 100)}%)`,
            inline: true
          },
          {
            name: 'XP Progress',
            value: `${progressBar}\n${progress.xpProgress.toLocaleString()} / ${progress.xpNeeded.toLocaleString()} XP (${progress.progressPercent}%)`,
            inline: false
          },
          {
            name: '📊 Statistics',
            value: 
              `📅 Member for ${daysSince} days\n` +
              `💸 ${stats.total_transactions} transactions\n` +
              `📈 ${stats.total_earned.toLocaleString()} total earned\n` +
              `📉 ${stats.total_spent.toLocaleString()} total spent`,
            inline: false
          }
        ],
        footer: { text: 'Use !achievements to see your unlocked achievements' },
        timestamp: new Date()
      };

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in profile command:', error);
      message.reply('❌ Error loading profile!');
    }
  }
};

function createProgressBar(percent, length = 10) {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}