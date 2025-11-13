const config = require('../config/config');
const Logger = require('../utils/logger');
const chatTracker = require('../services/chatTracker');


module.exports = {
  name: 'messageCreate',
  
  async execute(message, client) {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Ignore messages that don't start with prefix
    if (!message.content.startsWith(config.prefix)) return;
    
    // Parse command and arguments
    const args = message.content
      .slice(config.prefix.length)
      .trim()
      .split(/ +/);
    
    const commandName = args.shift().toLowerCase();
    
    // Get command from collection
    const command = client.commands.get(commandName);
    
    if (!command) return;
    
    // Execute command with error handling
    try {
      Logger.command(message.author.tag, commandName);
      await command.execute(message, args, client);
    } catch (error) {
      Logger.error(`Error executing ${commandName}:`, error);
      message.reply('❌ There was an error executing that command!');
    }
  }
};