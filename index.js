require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Logger = require('./src/utils/logger');
const chatTracker = require('./src/services/chatTracker');
const voiceTracker = require('./src/services/voiceTracker');
const streamNotifier = require('./src/services/streamNotifier');
const levelUp = require('./src/events/levelUp');
const achievementService = require('./src/config/achievements');
const { startDashboard } = require('./src/dashboard/server');
const { testConnection } = require('./src/database/connection');
const twitchBot = require('./src/services/twitchBot');

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
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
async function startBot() {
  Logger.info('🚀 Starting Babaloo Bot...');

  // Test database connection first
  Logger.info('Testing database connection...');
  const dbConnected = await testConnection();

  if (!dbConnected) {
    Logger.error('Failed to connect to database. Bot will still start but database features may not work.');
    Logger.info('Retrying in 5 seconds...');
    setTimeout(async () => {
      const retryConnected = await testConnection();
      if (retryConnected) {
        Logger.success('Database connection established on retry!');
      }
    }, 5000);
  }

  loadCommands();
  loadEvents();

  // Login to Discord
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    Logger.error('Failed to login:', err);
    process.exit(1);
  });
}

startBot();

// Replace 'ready' with 'clientReady'
client.once('clientReady', async () => {
  Logger.success(`Logged in as ${client.user.tag}`);

  // Initialize Twitch bot
  try {
    const twitchConnected = await twitchBot.initialize(client);
    if (twitchConnected) {
      Logger.success('Twitch bot integration enabled');
    }
  } catch (error) {
    Logger.error('Error initializing Twitch bot:', error);
  }

  // Initialize voice tracker
  try {
    await voiceTracker.initializeExistingUsers(client);
    voiceTracker.start(client);
    Logger.success('Voice tracking enabled');
  } catch (error) {
    Logger.error('Error initializing voice tracker:', error);
  }

  // Initialize stream notifier
  try {
    const notifierStarted = await streamNotifier.start(client);
    if (notifierStarted) {
      Logger.success('Stream notifications enabled');
    }
  } catch (error) {
    Logger.error('Error initializing stream notifier:', error);
  }

  // Start dashboard server if port is set
  if (process.env.DASHBOARD_PORT) {
    try {
      startDashboard(client);
    } catch (error) {
      Logger.warn('Dashboard not available. Install dependencies: npm install express express-session passport passport-discord ejs');
    }
  }
});

// Handle voice state updates
client.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member;

  // User joined a voice channel
  if (!oldState.channel && newState.channel) {
    await voiceTracker.handleVoiceJoin(member, newState.channel);
  }
  // User left a voice channel
  else if (oldState.channel && !newState.channel) {
    await voiceTracker.handleVoiceLeave(member);
  }
  // User switched channels
  else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    await voiceTracker.handleVoiceLeave(member);
    await voiceTracker.handleVoiceJoin(member, newState.channel);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  Logger.info('👋 Shutting down gracefully...');
  voiceTracker.stop();
  streamNotifier.stop();
  await twitchBot.disconnect();
  client.destroy();
  process.exit(0);
});
