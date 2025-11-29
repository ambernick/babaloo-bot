const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands or info about a specific command')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('The command you want details about')
        .setRequired(false)
    ),
    category: 'utility', // ⭐ REQUIRED ⭐


  async execute(interaction, client) {
    await interaction.deferReply();

    const commandName = interaction.options.getString('command');

    // ========== SPECIFIC COMMAND HELP ==========
    if (commandName) {
      const cmd = client.commands.get(commandName.toLowerCase());
      if (!cmd) {
        return interaction.editReply(`❌ Command **${commandName}** not found!`);
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle(`📖 /${cmd.data.name}`)
        .setDescription(cmd.data.description)
        .addFields(
          {
            name: 'Category',
            value: cmd.category || 'Uncategorized',
            inline: true
          },
          {
            name: 'Usage',
            value: `/${cmd.data.name}`,
            inline: false
          }
        )
        .setFooter({ text: 'Babaloo Bot' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ========== FULL COMMAND LIST ==========
    const categories = {};

client.commands.forEach(cmd => {
  const category = cmd.category || 'uncategorized';

  if (!categories[category]) categories[category] = [];
  categories[category].push(cmd);
});

const fields = Object.entries(categories).map(([category, commands]) => ({
  name: `${getCategoryEmoji(category)} ${capitalize(category)}`,
  value: commands
  .map(c => {
    const name = c?.data?.name ?? 'unknown';
    const description = c?.data?.description ?? 'No description available.';
    return `• \`/${name}\` — ${description}`;
  })
  .join('\n'),
  inline: false
}));

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('📚 Babaloo Bot Commands')
      .setDescription(`Use \`/help command:<name>\` for info on a specific command.`)
      .addFields(fields)
      .setFooter({ text: 'Babaloo Bot v0.1 | falsettovibrato' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};

// Helper functions
function getCategoryEmoji(category) {
  const emojis = {
    utility: '🛠️',
    economy: '💰',
    profile: '👤',
    admin: '⚙️'
  };
  return emojis[category] || '📌';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
