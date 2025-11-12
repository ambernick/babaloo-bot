// Load environment variables from .env file
require('dotenv').config();
// Import Discord.js library
const { CLient, GatewayIntentBits, Client } = require('discord.js');
// Create a new Discord client (your bot)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,              // Access to server info
        GatewayIntentBits.GuildMessages,       // Read messages in server
        GatewayIntentBits.MessageContent,      // Read message text
    ]
});
// This runs ONCE when bot comes online
client.once('clientReady', () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    console.log(`🤖 Bot is online and ready!`);
    console.log(`👥 Serving ${client.guilds.cache.size} servers`);
});
// This runs EVERY TIME someone sends a message
client.on('messageCreate', (message) => {
    // Ignore messages from bots (including ourselves)
    if(message.author.bot) return;
    // Respond to !ping command
    if (message.content === '!ping') {
        message.reply('🏓 Pong!');
      }
      // Respond to !hello command
    if (message.content === '!hello') {
    message.reply(`👋 Hey ${message.author.username}! I'm Babaloo!`);
  }
    // Respond to !help command
    if (message.content === '!help') {
    message.reply('**Available Commands:**\n`!ping` - Test if I\'m alive\n`!hello` - Get a greeting\n`!help` - Show this message');
  }
});

// Login to Discord with your token
client.login(process.env.DISCORD_TOKEN);
