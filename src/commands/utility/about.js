// src/commands/utility/about.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('about')
    .setDescription('Information about Babaloo Bot'),
    category: 'utility', // ⭐ REQUIRED ⭐


  async execute(interaction) {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('🤖 About Babaloo Bot')
      .setDescription('A custom multi-platform engagement bot for the falsettovibrato community')
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .addFields(
        {
          name: '👨‍💻 Developer',
          value: 'falsettovibrato',
          inline: true
        },
        {
          name: '📅 Version',
          value: 'v2.0.0 - Slash Commands',
          inline: true
        },
        {
          name: '⏱️ Uptime',
          value: `${days}d ${hours}h ${minutes}m`,
          inline: true
        },
        {
          name: '🌟 Features',
          value: 'Economy • Achievements • Leaderboards • Cross-platform',
          inline: false
        },
        {
          name: '🔗 Links',
          value: '[Twitch](https://twitch.tv/falsettovibrato) • [Store](https://ambersarcade.com) • [GitHub](https://github.com/ambernick/babaloo-bot)',
          inline: false
        },
        {
          name: '📊 Stats',
          value: `${interaction.client.guilds.cache.size} servers • ${interaction.client.users.cache.size} users`,
          inline: false
        }
      )
      .setFooter({ text: 'Built with Discord.js & PostgreSQL' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }
};