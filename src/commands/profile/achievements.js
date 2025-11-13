const achievementService = require('../../services/achievementService');
const config = require('../../config/config');
const userService = require('../../services/userService');

module.exports = {
  name: 'achievements',
  aliases: ['ach', 'achieve'],
  description: 'View your achievements',
  usage: '!achievements [@user]',
  category: 'profile',
  
  async execute(message, args, client) {
    try {
      const targetUser = message.mentions.users.first() || message.author;
      
      const userResult = await userService.getOrCreateUser(
        targetUser.id,
        targetUser.username
      );

      if (!userResult.success) {
        return message.reply('❌ User not found!');
      }

      const achResult = await achievementService.getUserAchievements(userResult.user.id);

      if (!achResult.success) {
        return message.reply('❌ Error loading achievements!');
      }

      const achievements = achResult.achievements;
      const completed = achievements.filter(a => a.completed_at);
      const inProgress = achievements.filter(a => !a.completed_at);

      // Group by category
      const categories = {};
      achievements.forEach(ach => {
        if (!categories[ach.category]) {
          categories[ach.category] = { completed: [], inProgress: [] };
        }
        if (ach.completed_at) {
          categories[ach.category].completed.push(ach);
        } else {
          categories[ach.category].inProgress.push(ach);
        }
      });

      // Create fields for each category
      const fields = [];
      
      for (const [category, achs] of Object.entries(categories)) {
        if (achs.completed.length > 0) {
          fields.push({
            name: `${getCategoryEmoji(category)} ${capitalize(category)} (Completed)`,
            value: achs.completed
              .map(a => `✅ **${a.name}** - ${a.description}`)
              .join('\n') || 'None',
            inline: false
          });
        }
        
        if (achs.inProgress.length > 0 && fields.length < 10) { // Discord embed limit
          fields.push({
            name: `${getCategoryEmoji(category)} ${capitalize(category)} (Available)`,
            value: achs.inProgress
              .slice(0, 5)
              .map(a => `⭕ **${a.name}** - ${a.description}`)
              .join('\n') || 'None',
            inline: false
          });
        }
      }

      const embed = {
        color: config.colors.primary,
        title: `🏆 ${targetUser.username}'s Achievements`,
        description: `**${completed.length}** / **${achievements.length}** completed`,
        thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) },
        fields: fields.slice(0, 10), // Discord limit
        footer: { 
          text: `Keep chatting and completing tasks to unlock more achievements!` 
        },
        timestamp: new Date()
      };

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in achievements command:', error);
      message.reply('❌ Error loading achievements!');
    }
  }
};

function getCategoryEmoji(category) {
  const emojis = {
    starter: '🎯',
    engagement: '💬',
    special: '⭐',
    account: '🔗',
    social: '🤝',
    milestone: '🏅',
    economy: '💰',
    inventory: '🎒'
  };
  return emojis[category] || '🏆';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}