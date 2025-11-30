const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency and response time'),

  category: 'utility',

  async execute(interaction, client) {
    const start = Date.now();

    // Acknowledge the command immediately
    await interaction.deferReply();

    // Calculate bot latency (time between deferReply and now)
    const botLatency = Date.now() - start;

    // Discord API WebSocket latency
    const apiLatency = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('🏓 Pong!')
      .addFields(
        {
          name: '📡 Bot Latency',
          value: `**${botLatency}ms**`,
          inline: true
        },
        {
          name: '💻 API Latency',
          value: `**${apiLatency}ms**`,
          inline: true
        }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
