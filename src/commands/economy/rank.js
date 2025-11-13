const userService = require('../../services/userService');
const db = require('../../database/connection');
const config = require('../../config/config');

module.exports = {
  name: 'rank',
  aliases: ['level', 'xp'],
  description: 'Check your level and rank',
  usage: '!rank [@user]',
  category: 'economy',
  
  async execute(message, args) {
    try {
      const targetUser = message.mentions.users.first() || message.author;
      
      const dbUser = await userService.getOrCreateUser(
        targetUser.id,
        targetUser.username
      );

      // Get user's rank by XP
      const rankResult = await db.query(
        `SELECT COUNT(*) + 1 as rank 
         FROM users 
         WHERE xp > $1`,
        [dbUser.xp]
      );
      const rank = rankResult.rows[0].rank;

      // Get total users
      const totalResult = await db.query('SELECT COUNT(*) as total FROM users');
      const totalUsers = totalResult.rows[0].total;

      // Calculate level progress
      const currentLevel = dbUser.level;
      const currentXP = dbUser.xp;
      const xpForCurrent = (currentLevel - 1) ** 2 * 100;
      const xpForNext = currentLevel ** 2 * 100;
      const xpProgress = currentXP - xpForCurrent;
      const xpNeeded = xpForNext - xpForCurrent;
      const progressPercent = Math.round((xpProgress / xpNeeded) * 100);

      // Create visual progress bar
      const barLength = 20;
      const filledBars = Math.round((progressPercent / 100) * barLength);
      const emptyBars = barLength - filledBars;
      const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

      const embed = {
        color: config.colors.info,
        title: `⭐ ${targetUser.username}'s Rank`,
        thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) },
        description: `**Rank #${rank}** out of ${totalUsers} users`,
        fields: [
          {
            name: `Level ${currentLevel}`,
            value: `Total XP: **${currentXP.toLocaleString()}**`,
            inline: false
          },
          {
            name: `Progress to Level ${currentLevel + 1}`,
            value: `${progressBar}\n${xpProgress.toLocaleString()} / ${xpNeeded.toLocaleString()} XP (${progressPercent}%)`,
            inline: false
          },
          {
            name: '💡 How to Level Up',
            value: 'Chat in Discord • Complete achievements • Participate in events',
            inline: false
          }
        ],
        timestamp: new Date()
      };

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in rank command:', error);
      message.reply('❌ Error fetching rank. Please try again!');
    }
  }
};

// ============================================
// Step 6: Update messageCreate Event Handler
// src/events/messageCreate.js
// ============================================

const config = require('../config/config');
const Logger = require('../utils/logger');
const chatTracker = require('../services/chatTracker');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    // Track message for currency earning (background task)
    chatTracker.handleMessage(message).catch(err => {
      Logger.error('Error tracking message:', err);
    });

    // Command handling
    if (message.author.bot) return;
    if (!message.content.startsWith(config.prefix)) return;
    
    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    const command = client.commands.get(commandName) || 
                   client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    
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