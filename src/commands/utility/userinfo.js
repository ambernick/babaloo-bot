const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display information about a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to view (defaults to yourself)')
        .setRequired(false)
    ),

  category: 'utility',

  async execute(interaction, client) {
    await interaction.deferReply();

    // Get user or fallback to the person using the command
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id);

    const roles = member.roles.cache
      .filter(role => role.id !== interaction.guild.id) // remove @everyone
      .map(role => role.name)
      .slice(0, 10)
      .join(', ') || 'None';

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: '🆔 User ID',
          value: user.id,
          inline: false
        },
        {
          name: '📅 Account Created',
          value: user.createdAt.toLocaleDateString(),
          inline: true
        },
        {
          name: '📅 Joined Server',
          value: member.joinedAt.toLocaleDateString(),
          inline: true
        },
        {
          name: '🎭 Roles',
          value: roles,
          inline: false
        }
      )
      .setTimestamp();

    interaction.editReply({ embeds: [embed] });
  }
};
