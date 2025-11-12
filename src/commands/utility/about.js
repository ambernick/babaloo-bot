const config = require('../../config/config');

module.exports = {
  name: 'about',
  description: 'Information about Babaloo Bot',
  usage: '!about',
  category: 'utility',
  
  async execute(message, args, client) {
    // Calculate bot uptime
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const embed = {
      color: config.colors.primary,
      title: '🤖 About Babaloo Bot',
      description: 'A custom multi-platform engagement bot for the falsettovibrato community',
      thumbnail: {
        url: client.user.displayAvatarURL()
      },
      fields: [
        {
          name: '👨‍💻 Developer',
          value: 'falsettovibrato',
          inline: true
        },
        {
          name: '📅 Version',
          value: 'v0.1.0 - MVP Phase',
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
          value: `${client.guilds.cache.size} servers • ${client.users.cache.size} users`,
          inline: false
        }
      ],
      footer: {
        text: 'Built with Discord.js & PostgreSQL'
      },
      timestamp: new Date()
    };
    
    message.reply({ embeds: [embed] });
  }
};