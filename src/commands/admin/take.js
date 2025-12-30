const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');
const currencyService = require('../../services/currencyService');
const userService = require('../../services/userService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('take')
    .setDescription('[ADMIN] Remove resources from a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to take resources from')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type of resource to remove')
        .setRequired(true)
        .addChoices(
          { name: 'Currency (Coins)', value: 'currency' },
          { name: 'Premium Currency (Gems)', value: 'premium' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount to remove')
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

      // Remove the appropriate resource
      switch (type) {
        case 'currency':
          result = await currencyService.spendCurrency(
            dbUser.id,
            amount,
            'admin_removal',
            `Admin removal by ${interaction.user.username}`
          );
          resourceName = 'Coins';
          emoji = '🪙';
          break;

        case 'premium':
          // Manually update premium currency
          const db = require('../../database/connection');

          // Check if user has enough
          if (dbUser.premium_currency < amount) {
            return interaction.editReply({
              content: `❌ ${targetUser} only has ${dbUser.premium_currency} 💎 Gems (trying to remove ${amount}).`,
              ephemeral: true
            });
          }

          await db.query(
            'UPDATE users SET premium_currency = premium_currency - $1 WHERE id = $2',
            [amount, dbUser.id]
          );
          result = { success: true };
          resourceName = 'Gems';
          emoji = '💎';
          break;
      }

      if (!result.success) {
        return interaction.editReply({
          content: `❌ Error removing ${resourceName}: ${result.error || 'User does not have enough resources.'}`,
          ephemeral: true
        });
      }

      // Send success message
      const embed = new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle('✅ Resources Removed')
        .setDescription(
          `Successfully removed **${amount}** ${emoji} ${resourceName} from ${targetUser}`
        )
        .addFields(
          {
            name: 'Admin',
            value: interaction.user.toString(),
            inline: true
          },
          {
            name: 'Target User',
            value: targetUser.toString(),
            inline: true
          },
          {
            name: 'Amount Removed',
            value: `${amount} ${emoji} ${resourceName}`,
            inline: true
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Admin Removal' });

      await interaction.editReply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error in take command:', error);
      return interaction.editReply({
        content: '❌ An error occurred while removing resources.',
        ephemeral: true
      });
    }
  }
};
