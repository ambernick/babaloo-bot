const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/config');
const userService = require('../../services/userService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link-twitch')
    .setDescription('Link your Twitch account to share progress across platforms'),

  category: 'utility',

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const discordId = interaction.user.id;
      const username = interaction.user.username;

      // Get or create Discord user
      const userResult = await userService.getOrCreateUser(discordId, username);

      if (!userResult.success) {
        return interaction.editReply({
          content: '❌ Error creating your account. Please try again.',
          ephemeral: true
        });
      }

      const user = userResult.user;

      // Check if already linked
      if (user.twitch_id) {
        return interaction.editReply({
          content: `✅ Your account is already linked to Twitch!\n\nIf you want to unlink, contact an administrator.`,
          ephemeral: true
        });
      }

      // Check if Twitch OAuth is configured
      if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_OAUTH_CALLBACK_URL) {
        return interaction.editReply({
          content: '❌ Twitch OAuth is not configured. Please contact an administrator.',
          ephemeral: true
        });
      }

      // Generate Twitch OAuth URL
      const twitchAuthUrl = new URL('https://id.twitch.tv/oauth2/authorize');
      twitchAuthUrl.searchParams.append('client_id', process.env.TWITCH_CLIENT_ID);
      twitchAuthUrl.searchParams.append('redirect_uri', process.env.TWITCH_OAUTH_CALLBACK_URL);
      twitchAuthUrl.searchParams.append('response_type', 'code');
      twitchAuthUrl.searchParams.append('scope', 'user:read:email');
      twitchAuthUrl.searchParams.append('state', user.id.toString()); // Pass user DB ID as state

      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('🔗 Link Your Twitch Account')
        .setDescription('Click the button below to securely link your Twitch account!')
        .addFields(
          {
            name: '📝 How it works:',
            value: '1. Click the "Link Twitch Account" button\n2. Log in to Twitch (if not already logged in)\n3. Click "Authorize" to allow the bot to verify your account\n4. You\'ll be redirected to a success page\n5. Done! Your accounts are linked!'
          },
          {
            name: '🔒 Security',
            value: 'This uses official Twitch OAuth for secure authentication. We only request permission to verify your identity.'
          }
        )
        .setFooter({ text: 'Once linked, your progress will sync across Discord and Twitch!' })
        .setTimestamp();

      const button = new ButtonBuilder()
        .setLabel('Link Twitch Account')
        .setStyle(ButtonStyle.Link)
        .setURL(twitchAuthUrl.toString())
        .setEmoji('🔗');

      const row = new ActionRowBuilder().addComponents(button);

      await interaction.editReply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in link-twitch command:', error);
      return interaction.editReply({
        content: '❌ An error occurred while generating your link. Please try again.',
        ephemeral: true
      });
    }
  }
};
