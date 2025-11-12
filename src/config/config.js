// Configuration settings for the bot
module.exports = {
    // Command prefix
    prefix: process.env.BOT_PREFIX || '!',
    // Admin user ID (your Discord ID)
    adminUserId: process.env.ADMIN_USER_ID || '',
   // Currency settings
    currency: {
        name: 'Coins',
        emoji: '🪙',
        chatEarningRate: 1,        // Currency per minute of chatting
        maxPerHour: 60,            // Maximum currency per hour
        dailyBonus: 100            // Daily bonus amount
  },
   // XP settings
   xp: {
    chatRate: 2,               // XP per message
    levelFormula: (xp) => Math.floor(Math.sqrt(xp / 100)) + 1
  },
  // Discord embed colors (hex codes)
  colors: {
    primary: 0x9b59b6,   // Purple
    success: 0x2ecc71,   // Green
    error: 0xe74c3c,     // Red
    warning: 0xf39c12,   // Orange
    info: 0x3498db       // Blue
  }
};