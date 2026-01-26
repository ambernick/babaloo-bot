// src/commands/admin/set-levelup-channel.js
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const settingsService = require('../../services/settingsService');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('set-levelup-channel')
    .setDescription('[ADMIN] Set the channel where level up notifications are sent')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The channel for level up notifications (leave empty to use chat channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Check if user is the bot admin
      if (interaction.user.id !== process.env.ADMIN_USER_ID) {
        return await interaction.editReply({
          content: '❌ This command is only available to the bot administrator.',
          ephemeral: true
        });
      }

      const channel = interaction.options.getChannel('channel');

      // Update the setting
      if (channel) {
        // Set to specific channel
        await settingsService.setSetting('levelup_notification_channel_id', channel.id);

        return await interaction.editReply({
          content: `✅ Level up notifications will now be sent to ${channel}!\n\n` +
            `All level ups will be announced in that channel instead of the chat channel.`,
          ephemeral: true
        });
      } else {
        // Clear the setting (use chat channel)
        await settingsService.setSetting('levelup_notification_channel_id', '');

        return await interaction.editReply({
          content: '✅ Level up notifications will now be sent in the same channel where they were earned (chat channel).\n\n' +
            'This is the default behavior.',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error setting level up channel:', error);

      return await interaction.editReply({
        content: '❌ An error occurred while setting the level up notification channel. ' +
          'Make sure the bot_settings table exists (run `node scripts/add-bot-settings.js`).',
        ephemeral: true
      });
    }
  }
};
