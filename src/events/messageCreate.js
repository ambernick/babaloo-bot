const config = require('../config/config');
const Logger = require('../utils/logger');
const chatTracker = require('../services/chatTracker');

module.exports = {
  name: 'messageCreate',
  
  async execute(message, client) {
    // Track message for currency earning (background task)
    // This runs for ALL messages, even non-commands
    chatTracker.handleMessage(message).catch(err => {
      Logger.error('Error tracking message:', err);
    });

    // Command handling
    if (message.author.bot) return;
    if (!message.content.startsWith(config.prefix)) return;
    
    const args = message.content
      .slice(config.prefix.length)
      .trim()
      .split(/ +/);
    
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    
    if (!command) return;
    
    try {
      Logger.command(message.author.tag, commandName);
      await command.execute(message, args, client);
    } catch (error) {
      Logger.error(`Error executing ${commandName}:`, error);
      message.reply('❌ There was an error executing that command!');
    }
  }
};