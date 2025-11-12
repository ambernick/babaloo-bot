const config = require('../../config/config');

module.exports = {
  name: 'help',
  description: 'Show all available commands or info about a specific command',
  usage: '!help [command]',
  category: 'utility',
  
  async execute(message, args, client) {
    const { prefix } = config;
    
    // If user asks for help with specific command
    if (args[0]) {
      const commandName = args[0].toLowerCase();
      const command = client.commands.get(commandName);
      
      if (!command) {
        return message.reply(`❌ Command \`${commandName}\` not found!`);
      }
      
      // Show detailed info about specific command
      const embed = {
        color: config.colors.info,
        title: `📖 ${prefix}${command.name}`,
        description: command.description,
        fields: [
          {
            name: 'Usage',
            value: `\`${command.usage}\``,
            inline: false
          },
          {
            name: 'Category',
            value: command.category,
            inline: true
          }
        ],
        footer: {
          text: 'Babaloo Bot'
        },
        timestamp: new Date()
      };
      
      return message.reply({ embeds: [embed] });
    }
    
    // Show all commands grouped by category
    const categories = {};
    
    // Group commands by category
    client.commands.forEach(cmd => {
      if (!categories[cmd.category]) {
        categories[cmd.category] = [];
      }
      categories[cmd.category].push(cmd);
    });
    
    // Create fields for each category
    const fields = Object.entries(categories).map(([category, commands]) => ({
      name: `${getCategoryEmoji(category)} ${capitalize(category)}`,
      value: commands
        .map(c => `\`${prefix}${c.name}\` - ${c.description}`)
        .join('\n'),
      inline: false
    }));
    
    // Create help embed
    const embed = {
      color: config.colors.primary,
      title: '📚 Babaloo Bot Commands',
      description: `Use \`${prefix}help [command]\` for detailed info about a specific command`,
      fields: fields,
      footer: {
        text: 'Babaloo Bot v0.1 | falsettovibrato'
      },
      timestamp: new Date()
    };
    
    message.reply({ embeds: [embed] });
  }
};

// Helper function to get emoji for category
function getCategoryEmoji(category) {
  const emojis = {
    utility: '🛠️',
    economy: '💰',
    profile: '👤',
    admin: '⚙️'
  };
  return emojis[category] || '📌';
}

// Helper function to capitalize first letter
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}