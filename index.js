require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Logger = require('./src/utils/logger');
const chatTracker = require('./src/services/chatTracker');
const levelUp = require('./src/events/levelUp')
const achievementService = require('./src/config/achievements');

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

// Initialize commands collection
client.commands = new Collection();

// Load all commands
function loadCommands() {
  Logger.info('Loading commands...');
  
  const commandFolders = fs.readdirSync(path.join(__dirname, 'src/commands'));
  
  for (const folder of commandFolders) {
    const commandPath = path.join(__dirname, 'src/commands', folder);
    const commandFiles = fs.readdirSync(commandPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const command = require(path.join(commandPath, file));
      
      // Support both slash commands (data.name) and old commands (name)
      const commandName = command.data ? command.data.name : command.name;
      
      if (commandName) {
        client.commands.set(commandName, command);
        Logger.success(`Loaded command: ${commandName} (${folder})`);
      } else {
        Logger.warn(`⚠️  Command in ${file} has no name!`);
      }
    }
  }
  
  Logger.info(`Total commands loaded: ${client.commands.size}`);
}


// Load all events
function loadEvents() {
  Logger.info('Loading events...');
  
  const eventFiles = fs.readdirSync(path.join(__dirname, 'src/events'))
    .filter(file => file.endsWith('.js'));
  
  for (const file of eventFiles) {
    const event = require(path.join(__dirname, 'src/events', file));
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    
    Logger.success(`Loaded event: ${event.name}`);
  }
}

// Initialize bot
Logger.info('🚀 Starting Babaloo Bot...');
loadCommands();
loadEvents();

// Login to Discord
client.login(process.env.DISCORD_TOKEN).catch(err => {
  Logger.error('Failed to login:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  Logger.info('👋 Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});