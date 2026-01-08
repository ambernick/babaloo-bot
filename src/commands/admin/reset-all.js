const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');
const db = require('../../database/connection');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset-all')
    .setDescription('[ADMIN] Reset ALL user stats - WARNING: PERMANENT!')
    .addStringOption(option =>
      option.setName('confirmation')
        .setDescription('Type: yes i want to reset everything, return to the past NOW!')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('unlink_twitch')
        .setDescription('Also unlink all Twitch accounts? (Default: false)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('delete_users')
        .setDescription('Delete all users completely? They will be recreated on next interaction (Default: false)')
        .setRequired(false)),

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

      const confirmation = interaction.options.getString('confirmation');
      const unlinkTwitch = interaction.options.getBoolean('unlink_twitch') || false;
      const deleteUsers = interaction.options.getBoolean('delete_users') || false;
      const requiredPhrase = 'yes i want to reset everything, return to the past NOW!';

      // Verify confirmation phrase
      if (confirmation !== requiredPhrase) {
        const warningEmbed = new EmbedBuilder()
          .setColor('#c92a2a')
          .setTitle('⚠️ INCORRECT CONFIRMATION PHRASE')
          .setDescription(
            '**The confirmation phrase does not match!**\n\n' +
            'Required phrase:\n' +
            `\`${requiredPhrase}\`\n\n` +
            '**Reset cancelled for safety.**'
          )
          .setTimestamp();

        return interaction.editReply({
          embeds: [warningEmbed],
          ephemeral: true
        });
      }

      // Show final warning before reset
      const warningEmbed = new EmbedBuilder()
        .setColor('#c92a2a')
        .setTitle('⚠️ FINAL WARNING - RESET ABOUT TO BEGIN')
        .setDescription(
          '**THIS WILL PERMANENTLY DELETE ALL USER DATA**\n\n' +
          'This includes:\n' +
          '• All currency and gems\n' +
          '• All XP and levels\n' +
          '• All achievements\n' +
          '• All transaction history\n' +
          '• All daily streaks\n' +
          (unlinkTwitch ? '• **ALL TWITCH ACCOUNT LINKS** (you selected this option)\n' : '') +
          (deleteUsers ? '• **ALL USER RECORDS** - Users will be completely deleted (you selected this option)\n' : '') +
          '\n*"Relink these chains of your own volition. The server must bear the inconvenience of one man\'s exploit."*\n\n' +
          (deleteUsers ? '**Note:** Users will be automatically recreated when they chat or interact again.\n\n' : '') +
          '**Proceeding with reset in 3 seconds...**'
        )
        .setTimestamp()
        .setFooter({ text: 'Admin Command' });

      await interaction.editReply({
        embeds: [warningEmbed],
        ephemeral: true
      });

      // Wait 3 seconds to allow admin to cancel if needed
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Perform the reset
      if (deleteUsers) {
        // Complete deletion of all users and related data
        // Foreign key constraints will cascade delete related records
        await db.query('DELETE FROM user_achievements');
        await db.query('DELETE FROM transactions');
        await db.query('DELETE FROM user_profiles');
        await db.query('DELETE FROM users');
      } else {
        // Just reset stats, keep user records
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
      }

      let successDescription = '';

      if (deleteUsers) {
        successDescription =
          '**All users have been completely deleted:**\n\n' +
          '✓ All user records deleted\n' +
          '✓ All user profiles deleted\n' +
          '✓ All achievements cleared\n' +
          '✓ All transaction history deleted\n\n' +
          '**Users will be automatically recreated when they:**\n' +
          '• Send a message in chat\n' +
          '• Use any bot command\n' +
          '• Are mentioned in a command by another user\n\n' +
          '**The slate has been wiped clean.**';
      } else {
        successDescription =
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
      }

      const successEmbed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('✅ All Stats Have Been Reset')
        .setDescription(successDescription)
        .setTimestamp()
        .setFooter({ text: `Reset by ${interaction.user.username}` });

      await interaction.followUp({
        embeds: [successEmbed],
        ephemeral: true
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
