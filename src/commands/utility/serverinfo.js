const config = require('../../config/config');

module.exports = {
  name: 'serverinfo',
  description: 'Display information about the current server',
  usage: '!serverinfo',
  category: 'utility',
  
  async execute(message, args, client) {
    const guild = message.guild;
    
    const embed = {
      color: config.colors.info,
      title: `📊 ${guild.name} Server Info`,
      thumbnail: {
        url: guild.iconURL({ dynamic: true })
      },
      fields: [
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
      ],
      timestamp: new Date()
    };
    
    message.reply({ embeds: [embed] });
  }
};