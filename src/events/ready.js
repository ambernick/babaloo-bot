const Logger = require('../utils/logger');

module.exports = {
  // Event name
  name: 'clientReady',
  
  // Only execute once when bot starts
  once: true,
  
  // Execute function
  execute(client) {
    Logger.success(`Logged in as ${client.user.tag}!`);
    Logger.info(`Serving ${client.guilds.cache.size} servers`);
    Logger.info(`Monitoring ${client.users.cache.size} users`);
    
    // Set bot activity status
    client.user.setPresence({
      activities: [{
        name: process.env.BOT_STATUS || '/help for commands', // default fallback
        type: process.env.BOT_ACTIVITY_TYPE ? parseInt(process.env.BOT_ACTIVITY_TYPE) : 3 // default: Watching
      }],
      status: process.env.BOT_ONLINE_STATUS || 'online' // default: online
    });
  }
};