const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');
const currencyService = require('../../services/currencyService');
const xpService = require('../../services/xpService');
const userService = require('../../services/userService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('give')
    .setDescription('[ADMIN] Give resources to a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to give resources to')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type of resource to give')
        .setRequired(true)
        .addChoices(
          { name: 'Currency (Coins)', value: 'currency' },
          { name: 'Premium Currency (Gems)', value: 'premium' },
          { name: 'XP', value: 'xp' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount to give')
        .setRequired(true)
        .setMinValue(1)
    ),

  category: 'admin',

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Check if user is admin
      if (interaction.user.id !== process.env.ADMIN_USER_ID) {
        return interaction.editReply({
          content: '❌ This command is only available to administrators.',
          ephemeral: true
        });
      }

      const targetUser = interaction.options.getUser('user');
      const type = interaction.options.getString('type');
      const amount = interaction.options.getInteger('amount');

      // Get or create target user in database
      const userResult = await userService.getOrCreateUser(targetUser.id, targetUser.username);

      if (!userResult.success) {
        return interaction.editReply({
          content: '❌ Error finding user in database.',
          ephemeral: true
        });
      }

      const dbUser = userResult.user;
      let result;
      let resourceName;
      let emoji;

      // Give the appropriate resource
      switch (type) {
        case 'currency':
          result = await currencyService.awardCurrency(
            dbUser.id,
            amount,
            'admin_grant',
            `Admin grant by ${interaction.user.username}`
          );
          resourceName = 'Coins';
          emoji = '🪙';
          break;

        case 'premium':
          // Check if premium currency method exists
          if (typeof currencyService.awardPremiumCurrency === 'function') {
            result = await currencyService.awardPremiumCurrency(
              dbUser.id,
              amount,
              'admin_grant',
              `Admin grant by ${interaction.user.username}`
            );
          } else {
            // Fallback: manually update premium currency
            const db = require('../../database/connection');
            await db.query(
              'UPDATE users SET premium_currency = premium_currency + $1 WHERE id = $2',
              [amount, dbUser.id]
            );
            result = { success: true };
          }
          resourceName = 'Gems';
          emoji = '💎';
          break;

        case 'xp':
          result = await xpService.awardXP(
            dbUser.id,
            amount,
            'admin_grant'
          );
          resourceName = 'XP';
          emoji = '⭐';

          // Handle level up
          if (result.leveledUp) {
            const levelUpEmbed = new EmbedBuilder()
              .setColor(config.colors.success)
              .setTitle('🎉 Level Up Triggered!')
              .setDescription(
                `${targetUser} leveled up from **Level ${result.oldLevel}** to **Level ${result.newLevel}**!`
              )
              .setTimestamp();

            await interaction.followUp({ embeds: [levelUpEmbed], ephemeral: true });
          }
          break;
      }

      if (!result.success) {
        return interaction.editReply({
          content: `❌ Error giving ${resourceName}: ${result.error}`,
          ephemeral: true
        });
      }

      // Send success message
      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('✅ Resources Granted')
        .setDescription(
          `Successfully gave **${amount}** ${emoji} ${resourceName} to ${targetUser}`
        )
        .addFields(
          {
            name: 'Admin',
            value: interaction.user.toString(),
            inline: true
          },
          {
            name: 'Recipient',
            value: targetUser.toString(),
            inline: true
          },
          {
            name: 'Amount',
            value: `${amount} ${emoji} ${resourceName}`,
            inline: true
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Admin Grant' });

      await interaction.editReply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error in give command:', error);
      return interaction.editReply({
        content: '❌ An error occurred while giving resources.',
        ephemeral: true
      });
    }
  }
};
