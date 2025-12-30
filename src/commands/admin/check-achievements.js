const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');
const achievementService = require('../../services/achievementService');
const userService = require('../../services/userService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check-achievements')
    .setDescription('[ADMIN] Manually check and award achievements for a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check achievements for')
        .setRequired(true)),

  category: 'admin',

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Check if user is admin
      if (interaction.user.id !== process.env.ADMIN_USER_ID) {
        return interaction.editReply({
          content: '❌ This command is only available to administrators.',
          ephemeral: true
        });
      }

      const targetUser = interaction.options.getUser('user');

      // Get or create user in database
      const userResult = await userService.getOrCreateUser(targetUser.id, targetUser.username);

      if (!userResult.success) {
        return interaction.editReply({
          content: '❌ Failed to find user in database.',
          ephemeral: true
        });
      }

      const dbUser = userResult.user;

      // Check all achievements for this user
      const newAchievements = await achievementService.autoCheckAchievements(dbUser.id);

      if (newAchievements.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(config.colors.info)
          .setTitle('✅ Achievement Check Complete')
          .setDescription(`No new achievements unlocked for **${targetUser.username}**.`)
          .setTimestamp();

        return interaction.editReply({
          embeds: [embed],
          ephemeral: true
        });
      }

      // Build list of newly unlocked achievements
      const achievementList = newAchievements.map(ach =>
        `🏆 **${ach.name}** - ${ach.description}`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('✅ Achievement Check Complete')
        .setDescription(
          `**${newAchievements.length}** new achievement(s) unlocked for **${targetUser.username}**:\n\n${achievementList}`
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in check-achievements command:', error);
      return interaction.editReply({
        content: '❌ An error occurred while checking achievements.',
        ephemeral: true
      });
    }
  }
};
