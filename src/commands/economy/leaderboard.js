const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/connection');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server leaderboards')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Leaderboard category to view')
        .setRequired(false)
        .addChoices(
          { name: '🪙 Currency', value: 'currency' },
          { name: '⭐ XP & Levels', value: 'xp' },
          { name: '🏆 Achievements', value: 'achievements' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('page')
        .setDescription('Page number (default: 1)')
        .setRequired(false)
        .setMinValue(1)
    ),
  category: 'economy',

  async execute(interaction, client) {
    await interaction.deferReply();

    try {
      const category = interaction.options.getString('category') || 'xp';
      const page = interaction.options.getInteger('page') || 1;
      const perPage = 10;
      const offset = (page - 1) * perPage;

      // Exclude admin from leaderboards
      const adminId = process.env.ADMIN_USER_ID;

      let query;
      let countQuery;
      let title;
      let icon;
      let formatValue;

      switch (category) {
        case 'currency':
          query = `
            SELECT discord_id, username, currency
            FROM users
            WHERE discord_id != $1
            ORDER BY currency DESC
            LIMIT $2 OFFSET $3
          `;
          countQuery = `SELECT COUNT(*) as total FROM users WHERE discord_id != $1`;
          title = '🪙 Currency Leaderboard';
          icon = '🪙';
          formatValue = (user) => `${user.currency.toLocaleString()} coins`;
          break;

        case 'xp':
          query = `
            SELECT discord_id, username, xp, level
            FROM users
            WHERE discord_id != $1
            ORDER BY xp DESC
            LIMIT $2 OFFSET $3
          `;
          countQuery = `SELECT COUNT(*) as total FROM users WHERE discord_id != $1`;
          title = '⭐ XP & Level Leaderboard';
          icon = '⭐';
          formatValue = (user) => `Level ${user.level} • ${user.xp.toLocaleString()} XP`;
          break;

        case 'achievements':
          query = `
            SELECT u.discord_id, u.username, COUNT(ua.id) as achievement_count
            FROM users u
            LEFT JOIN user_achievements ua ON u.id = ua.user_id AND ua.completed_at IS NOT NULL
            WHERE u.discord_id != $1
            GROUP BY u.id, u.discord_id, u.username
            ORDER BY achievement_count DESC
            LIMIT $2 OFFSET $3
          `;
          countQuery = `SELECT COUNT(*) as total FROM users WHERE discord_id != $1`;
          title = '🏆 Achievement Leaderboard';
          icon = '🏆';
          formatValue = (user) => `${user.achievement_count} achievement${user.achievement_count !== 1 ? 's' : ''}`;
          break;

        default:
          return interaction.editReply('❌ Invalid category!');
      }

      // Get leaderboard data
      const result = await db.query(query, [adminId, perPage, offset]);
      const countResult = await db.query(countQuery, [adminId]);
      const totalUsers = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalUsers / perPage);

      if (result.rows.length === 0) {
        return interaction.editReply('❌ No users found on the leaderboard!');
      }

      // Find current user's rank
      let userRankQuery;
      switch (category) {
        case 'currency':
          userRankQuery = `
            SELECT COUNT(*) + 1 as rank
            FROM users
            WHERE currency > (SELECT currency FROM users WHERE discord_id = $1)
            AND discord_id != $2
          `;
          break;
        case 'xp':
          userRankQuery = `
            SELECT COUNT(*) + 1 as rank
            FROM users
            WHERE xp > (SELECT xp FROM users WHERE discord_id = $1)
            AND discord_id != $2
          `;
          break;
        case 'achievements':
          userRankQuery = `
            WITH user_achievements_count AS (
              SELECT u.id, COUNT(ua.id) as count
              FROM users u
              LEFT JOIN user_achievements ua ON u.id = ua.user_id AND ua.completed_at IS NOT NULL
              WHERE u.discord_id = $1
              GROUP BY u.id
            ),
            all_counts AS (
              SELECT u.id, COUNT(ua.id) as count
              FROM users u
              LEFT JOIN user_achievements ua ON u.id = ua.user_id AND ua.completed_at IS NOT NULL
              WHERE u.discord_id != $2
              GROUP BY u.id
            )
            SELECT COUNT(*) + 1 as rank
            FROM all_counts
            WHERE count > (SELECT count FROM user_achievements_count)
          `;
          break;
      }

      const userRankResult = await db.query(userRankQuery, [interaction.user.id, adminId]);
      const userRank = userRankResult.rows[0]?.rank || 'Unranked';

      // Build leaderboard text
      const startRank = offset + 1;
      const leaderboardText = result.rows.map((user, index) => {
        const rank = startRank + index;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
        const value = formatValue(user);
        const isCurrentUser = user.discord_id === interaction.user.id;
        const userText = isCurrentUser ? `**${user.username}** (You)` : user.username;

        return `${medal} ${userText}\n${icon} ${value}`;
      }).join('\n\n');

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(title)
        .setDescription(leaderboardText)
        .setFooter({
          text: `Page ${page}/${totalPages} • Your rank: #${userRank}`
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in leaderboard command:', error);
      await interaction.editReply('❌ Error fetching leaderboard. Please try again!');
    }
  }
};
