const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const achievementService = require('../../services/achievementService');
const config = require('../../config/config');
const userService = require('../../services/userService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View your achievements')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to check (defaults to yourself)')
        .setRequired(false)
    ),
  category: 'profile',

  async execute(interaction, client) {
    await interaction.deferReply(); // defer immediately

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;

      const userResult = await userService.getOrCreateUser(
        targetUser.id,
        targetUser.username
      );

      if (!userResult.success) {
        return await interaction.editReply('❌ User not found!');
      }

      const achResult = await achievementService.getUserAchievements(userResult.user.id);

      if (!achResult.success) {
        return await interaction.editReply('❌ Error loading achievements!');
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

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`🏆 ${targetUser.username}'s Achievements`)
        .setDescription(`**${completed.length}** / **${achievements.length}** completed`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(fields.slice(0, 10)) // Discord limit
        .setFooter({ 
          text: `Keep chatting and completing tasks to unlock more achievements!` 
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in achievements command:', error);
      await interaction.editReply('❌ Error loading achievements!');
    }
  }
};

// Helper functions
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
