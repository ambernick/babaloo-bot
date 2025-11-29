// src/commands/economy/balance.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userService = require('../../services/userService');
const config = require('../../config/config');

module.exports = {
  // This defines the slash command structure
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your currency and XP balance')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to check (defaults to yourself)')
        .setRequired(false)
    ),

  // Slash commands use 'interaction' instead of 'message'
  async execute(interaction) {
    // Defer reply immediately - gives you 15 minutes to respond
    await interaction.deferReply();

    try {
      // Get the user option (or default to command user)
      const targetUser = interaction.options.getUser('user') || interaction.user;
      
      // Get user from database (same as before)
      const dbResult = await userService.getOrCreateUser(
        targetUser.id,
        targetUser.username
      );

      if (!dbResult.success || !dbResult.user) {
        return interaction.editReply({
          content: '❌ User not found in database!',
          ephemeral: true // Only visible to command user
        });
      }

      const dbUser = dbResult.user;
      const currency = dbUser.currency ?? 0;
      const premiumCurrency = dbUser.premium_currency ?? 0;
      const currentLevel = dbUser.level ?? 1;
      const currentXP = dbUser.xp ?? 0;

      // Calculate XP progress (same logic as before)
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

      // Use EmbedBuilder (new) instead of embed object (old)
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`💰 ${targetUser.username}'s Balance`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
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
        )
        .setFooter({ text: 'Earn currency by chatting! Use /daily for bonus.' })
        .setTimestamp();

      // Use editReply instead of reply (since we deferred)
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in balance command:', error);
      
      // Handle errors gracefully
      const errorResponse = {
        content: '❌ Error fetching balance. Please try again!',
        ephemeral: true
      };
      
      // Check if we already replied
      if (interaction.deferred) {
        await interaction.editReply(errorResponse);
      } else {
        await interaction.reply(errorResponse);
      }
    }
  }
};