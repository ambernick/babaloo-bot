module.exports = {
    // Command name (what user types after !)
    name: 'ping',
    
    // Description for help menu
    description: 'Check bot latency and response time',
    
    // How to use the command
    usage: '!ping',
    
    // Category for organization
    category: 'utility',
    
    // The actual command logic
    async execute(message, args, client) {
      // Send initial message
      const sent = await message.reply('🏓 Pinging...');
      
      // Calculate latency (time between user message and bot response)
      const latency = sent.createdTimestamp - message.createdTimestamp;
      
      // Get API latency (connection to Discord)
      const apiLatency = Math.round(client.ws.ping);
      
      // Edit message with results
      sent.edit(
        `🏓 Pong!\n` +
        `📡 Bot Latency: **${latency}ms**\n` +
        `💻 API Latency: **${apiLatency}ms**`
      );
    }
  };