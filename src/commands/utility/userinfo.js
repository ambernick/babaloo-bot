const config = require('../../config/config');

module.exports = {
  name: 'userinfo',
  description: 'Display information about a user',
  usage: '!userinfo [@user]',
  category: 'utility',
  
  async execute(message, args, client) {
    // Get mentioned user or default to message author
    const user = message.mentions.users.first() || message.author;
    const member = message.guild.members.cache.get(user.id);
    
    const embed = {
      color: config.colors.info,
      title: `👤 ${user.tag}`,
      thumbnail: {
        url: user.displayAvatarURL({ dynamic: true })
      },
      fields: [
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
          value: member.roles.cache
            .filter(role => role.name !== '@everyone')
            .map(role => role.name)
            .slice(0, 5)
            .join(', ') || 'None',
          inline: false
        }
      ],
      timestamp: new Date()
    };
    
    message.reply({ embeds: [embed] });
  }
};