const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userService = require('../../services/userService');
const xpService = require('../../services/xpService');
const achievementService = require('../../services/achievementService');
const db = require('../../database/connection');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View detailed user profile')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to view (defaults to yourself)')
        .setRequired(false)
    ),

  category: 'profile',

  async execute(interaction, client) {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;

      const userResult = await userService.getOrCreateUser(
        targetUser.id,
        targetUser.username
      );

      if (!userResult.success) {
        return interaction.editReply('❌ User not found!');
      }

      const user = userResult.user;

      // Fetch extended stats
      const statsResult = await db.query(
        `SELECT 
          u.*,
          COUNT(DISTINCT ua.id) FILTER (WHERE ua.completed_at IS NOT NULL) AS achievements_completed,
          COUNT(DISTINCT t.id) AS total_transactions,
          COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'earn'), 0) AS total_earned,
          COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'spend'), 0) AS total_spent
         FROM users u
         LEFT JOIN user_achievements ua ON u.id = ua.user_id
         LEFT JOIN transactions t ON u.id = t.user_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [user.id]
      );

      const stats = statsResult.rows[0];

      // Rank
      const rankResult = await db.query(
        'SELECT COUNT(*) + 1 AS rank FROM users WHERE xp > $1',
        [stats.xp]
      );
      const rank = rankResult.rows[0].rank;

      // XP progress
      const progress = xpService.getLevelProgress(stats.xp, stats.level);
      const progressBar = createProgressBar(progress.progressPercent, 15);

      // Days since account created
      const daysSince = Math.floor(
        (Date.now() - new Date(stats.created_at)) / (1000 * 60 * 60 * 24)
      );

      // Total achievements
      const achResult = await db.query('SELECT COUNT(*) AS total FROM achievements');
      const totalAchievements = achResult.rows[0].total;

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`👤 ${targetUser.username}'s Profile`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          {
            name: '💰 Wealth',
            value: `🪙 **${stats.currency.toLocaleString()}** coins\n💎 **${stats.premium_currency}** gems`,
            inline: true
          },
          {
            name: '⭐ Level & Rank',
            value: `Level **${stats.level}**\nRank **#${rank}**`,
            inline: true
          },
          {
            name: '🏆 Achievements',
            value: `${stats.achievements_completed} / ${totalAchievements} (${Math.round((stats.achievements_completed / totalAchievements) * 100)}%)`,
            inline: true
          },
          {
            name: '📈 XP Progress',
            value: `${progressBar}\n${progress.xpProgress.toLocaleString()} / ${progress.xpNeeded.toLocaleString()} XP (${progress.progressPercent}%)`,
            inline: false
          },
          {
            name: '📊 Statistics',
            value:
              `📅 Member for **${daysSince}** days\n` +
              `💸 **${stats.total_transactions}** transactions\n` +
              `📈 **${stats.total_earned.toLocaleString()}** earned\n` +
              `📉 **${stats.total_spent.toLocaleString()}** spent`,
            inline: false
          }
        )
        .setFooter({ text: 'Use /🏆achievements to view your achievements' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in profile command:', error);
      return interaction.editReply('❌ Error loading profile!');
    }
  }
};

// Progress bar generator
function createProgressBar(percent, length = 10) {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
