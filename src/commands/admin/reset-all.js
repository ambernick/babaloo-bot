const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../../config/config');
const db = require('../../database/connection');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset-all')
    .setDescription('[ADMIN] Reset ALL user stats - WARNING: PERMANENT!'),

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

      // Create warning embed
      const warningEmbed = new EmbedBuilder()
        .setColor('#c92a2a')
        .setTitle('⚠️ RESET ALL STATS - FINAL WARNING')
        .setDescription(
          '**THIS WILL PERMANENTLY DELETE ALL USER DATA**\n\n' +
          'This includes:\n' +
          '• All currency and gems\n' +
          '• All XP and levels\n' +
          '• All achievements\n' +
          '• All transaction history\n' +
          '• All daily streaks\n\n' +
          '**Optional:** Unlink all Twitch accounts\n' +
          '*"Relink these chains of your own volition. The server must bear the inconvenience of one man\'s exploit."*\n\n' +
          '**THIS ACTION CANNOT BE UNDONE!**\n\n' +
          'To confirm, click the button below and choose your options.'
        )
        .setTimestamp()
        .setFooter({ text: 'Admin Command' });

      // Create confirmation button
      const confirmButton = new ButtonBuilder()
        .setCustomId('reset_confirm')
        .setLabel('I Understand - Show Confirmation')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(confirmButton);

      const message = await interaction.editReply({
        embeds: [warningEmbed],
        components: [row],
        ephemeral: true
      });

      // Create collector for button interaction
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000 // 1 minute timeout
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'reset_confirm') {
          // Show modal for confirmation phrase
          const modal = new ModalBuilder()
            .setCustomId('reset_modal')
            .setTitle('Reset All Stats - Confirmation');

          const confirmationInput = new TextInputBuilder()
            .setCustomId('confirmation_phrase')
            .setLabel('Type the confirmation phrase:')
            .setPlaceholder('yes i want to reset everything, return to the past NOW!')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          const twitchUnlinkInput = new TextInputBuilder()
            .setCustomId('unlink_twitch')
            .setLabel('Unlink Twitch? (type "yes" to unlink, or leave blank)')
            .setPlaceholder('Leave blank to keep Twitch links')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const row1 = new ActionRowBuilder().addComponents(confirmationInput);
          const row2 = new ActionRowBuilder().addComponents(twitchUnlinkInput);
          modal.addComponents(row1, row2);

          await i.showModal(modal);

          // Wait for modal submission - use interaction.awaitModalSubmit instead of i.awaitModalSubmit
          try {
            const submitted = await interaction.awaitModalSubmit({
              filter: (submit) => submit.customId === 'reset_modal' && submit.user.id === interaction.user.id,
              time: 120000 // 2 minutes
            });

            const phrase = submitted.fields.getTextInputValue('confirmation_phrase');
            // Safely get optional field - may be empty string
            let unlinkTwitchInput = '';
            try {
              unlinkTwitchInput = submitted.fields.getTextInputValue('unlink_twitch') || '';
            } catch (e) {
              unlinkTwitchInput = '';
            }
            const requiredPhrase = 'yes i want to reset everything, return to the past NOW!';
            const unlinkTwitch = unlinkTwitchInput.toLowerCase().trim() === 'yes';

            if (phrase !== requiredPhrase) {
              await submitted.reply({
                content: '❌ **Confirmation phrase does not match!** Reset cancelled for safety.',
                ephemeral: true
              });
              return;
            }

            // Phrase matches - proceed with reset
            await submitted.deferReply({ ephemeral: true });

            // Perform the reset
            if (unlinkTwitch) {
              // Reset stats AND unlink Twitch accounts
              await db.query(`
                UPDATE users
                SET currency = 0,
                    premium_currency = 0,
                    xp = 0,
                    level = 1,
                    twitch_id = NULL
              `);
            } else {
              // Reset stats only, keep Twitch links
              await db.query(`
                UPDATE users
                SET currency = 0,
                    premium_currency = 0,
                    xp = 0,
                    level = 1
              `);
            }

            await db.query('DELETE FROM user_achievements');
            await db.query('DELETE FROM transactions');
            await db.query(`
              UPDATE user_profiles
              SET streak_days = 0
            `);

            let successDescription =
              '**All user data has been permanently deleted:**\n\n' +
              '✓ All currency and gems reset to 0\n' +
              '✓ All XP reset to 0 and levels to 1\n' +
              '✓ All achievements cleared\n' +
              '✓ All transaction history deleted\n' +
              '✓ All daily streaks reset to 0\n';

            if (unlinkTwitch) {
              successDescription += '✓ All Twitch accounts unlinked\n';
            }

            successDescription += '\n**The slate has been wiped clean.**';

            const successEmbed = new EmbedBuilder()
              .setColor(config.colors.success)
              .setTitle('✅ All Stats Have Been Reset')
              .setDescription(successDescription)
              .setTimestamp()
              .setFooter({ text: `Reset by ${interaction.user.username}` });

            await submitted.editReply({
              embeds: [successEmbed],
              ephemeral: true
            });

          } catch (error) {
            console.error('Error in modal submission:', error);
            // If modal times out or user cancels, that's expected - no action needed
            // The error is logged for debugging
          }
        }
      });

    } catch (error) {
      console.error('Error in reset-all command:', error);
      return interaction.editReply({
        content: '❌ An error occurred while processing the reset command.',
        ephemeral: true
      });
    }
  }
};
