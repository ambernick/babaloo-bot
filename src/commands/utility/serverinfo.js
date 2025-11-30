const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display information about the current server'),

  category: 'utility',

  async execute(interaction, client) {
    await interaction.deferReply();

    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle(`📊 ${guild.name} Server Info`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        {
          name: '👥 Members',
          value: guild.memberCount.toString(),
          inline: true
        },
        {
          name: '📅 Created',
          value: guild.createdAt.toLocaleDateString(),
          inline: true
        },
        {
          name: '👑 Owner',
          value: `<@${guild.ownerId}>`,
          inline: true
        },
        {
          name: '💬 Channels',
          value: guild.channels.cache.size.toString(),
          inline: true
        },
        {
          name: '😊 Emojis',
          value: guild.emojis.cache.size.toString(),
          inline: true
        },
        {
          name: '🎭 Roles',
          value: guild.roles.cache.size.toString(),
          inline: true
        }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
