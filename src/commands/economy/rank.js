const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userService = require('../../services/userService');
const xpService = require('../../services/xpService');
const db = require('../../database/connection');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your level and rank')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to check (defaults to yourself)')
        .setRequired(false)
    ),
  category: 'economy',

  async execute(interaction, client) {
    await interaction.deferReply(); // defer immediately

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

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle(`⭐ ${targetUser.username}'s Rank`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(`**Rank #${rank}** out of ${totalUsers} users`)
        .addFields(
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
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in rank command:', error);
      await interaction.editReply('❌ Error fetching rank. Please try again!');
    }
  }
};
