// src/commands/economy/daily.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userService = require('../../services/userService');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily bonus (once per 24 hours)'),
    category: 'economy',

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const dbResult = await userService.getOrCreateUser(
        interaction.user.id,
        interaction.user.username
      );

      if (!dbResult.success || !dbResult.user) {
        return interaction.editReply({
          content: '❌ Could not find or create your user account!',
          ephemeral: true
        });
      }

      const dbUser = dbResult.user;
      const result = await userService.claimDaily(dbUser.id, interaction.user.username);

      if (!result.success) {
        return interaction.editReply({
          content: `⏰ ${result.message}`,
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('🎁 Daily Bonus Claimed!')
        .setDescription(result.message)
        .addFields(
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
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in daily command:', error);
      await interaction.editReply({
        content: '❌ Error claiming daily bonus. Please try again!',
        ephemeral: true
      });
    }
  }
};