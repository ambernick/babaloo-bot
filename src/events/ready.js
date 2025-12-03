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
      activities: [{ name: '/help for commands', type: 3 }], // Type 3 = "Watching"
      status: 'online'
    });
  }
};