const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');
const userService = require('../../services/userService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your profile statistics or another user’s stats')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to view (defaults to yourself)')
        .setRequired(false)
    ),

  category: 'utility',

  async execute(interaction, client) {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;

      // Get DB profile
      const userResult = await userService.getOrCreateUser(
        targetUser.id,
        targetUser.username
      );

      if (!userResult.success) {
        return interaction.editReply('❌ Error loading user profile!');
      }

      // Welcome new user
      if (userResult.isNew && targetUser.id === interaction.user.id) {
        return interaction.editReply(
          '👋 **Welcome to Babaloo Bot!**\n\n' +
          'Your profile has been created!\n' +
          '🪙 You start with **0 coins**\n' +
          '⭐ You start at **Level 1**\n\n' +
          'Start chatting to earn currency and XP!\n' +
          'Use `/help` for commands.'
        );
      }

      // Fetch stats
      const statsResult = await userService.getUserStats(targetUser.id);

      if (!statsResult.success) {
        return interaction.editReply('❌ Error loading stats!');
      }

      const stats = statsResult.stats;

      // Level calculations
      const currentLevel = stats.level;
      const currentXP = stats.xp;

      const xpForCurrent = (currentLevel - 1) ** 2 * 100;
      const xpForNext = currentLevel ** 2 * 100;
      const xpProgress = currentXP - xpForCurrent;
      const xpNeeded = xpForNext - xpForCurrent;
      const progressPercent = Math.round((xpProgress / xpNeeded) * 100);

      const barLength = 10;
      const filledBars = Math.round((progressPercent / 100) * barLength);
      const progressBar = '█'.repeat(filledBars) + '░'.repeat(barLength - filledBars);

      // Member age
      const daysSince = Math.floor(
        (Date.now() - new Date(stats.created_at)) / (1000 * 60 * 60 * 24)
      );

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`📊 ${targetUser.username}'s Stats`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          {
            name: '💰 Currency',
            value: `🪙 ${stats.currency?.toLocaleString() || 0} coins\n💎 ${stats.premium_currency || 0} gems`,
            inline: true
          },
          {
            name: '⭐ Level',
            value: `Level **${currentLevel}**\n${xpProgress.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`,
            inline: true
          },
          { name: '\u200b', value: '\u200b', inline: true },
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
        )
        .setFooter({ text: 'Keep chatting to earn more currency and XP!' })
        .setTimestamp();

      interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in stats command:', error);
      interaction.editReply('❌ An error occurred while loading stats!');
    }
  }
};
