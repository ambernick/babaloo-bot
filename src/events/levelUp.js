// src/events/levelUp.js
const config = require('../config/config');

module.exports = {
  name: 'levelUp',
  
  /**
   * Enhanced level-up announcement with rewards and unlocks
   * Call this from chatTracker when user levels up
   */
  async announce(channel, user, oldLevel, newLevel) {
    // Calculate level-up rewards
    const currencyReward = newLevel * 50; // Scales with level
    const premiumReward = Math.floor(newLevel / 5); // Every 5 levels = 1 gem
    
    // Check for milestone levels (5, 10, 25, 50, 100)
    const milestones = [5, 10, 25, 50, 100];
    const isMilestone = milestones.includes(newLevel);
    
    // Get unlocked features
    const unlocks = getUnlocksForLevel(newLevel);
    
    // Build embed
    const embed = {
      color: isMilestone ? config.colors.warning : config.colors.success,
      title: isMilestone ? '🎊 MILESTONE LEVEL UP! 🎊' : '⭐ Level Up!',
      description: `**${user.username}** just reached **Level ${newLevel}**!`,
      thumbnail: { url: user.displayAvatarURL({ dynamic: true }) },
      fields: [
        {
          name: '📈 Progress',
          value: `Level ${oldLevel} → ${newLevel}`,
          inline: true
        },
        {
          name: '🎁 Rewards',
          value: `+${currencyReward} 🪙${premiumReward > 0 ? `\n+${premiumReward} 💎` : ''}`,
          inline: true
        }
      ],
      timestamp: new Date()
    };
    
    // Add unlocks if any
    if (unlocks.length > 0) {
      embed.fields.push({
        name: '🔓 New Unlocks',
        value: unlocks.map(u => `• ${u}`).join('\n'),
        inline: false
      });
    }
    
    // Add milestone bonus
    if (isMilestone) {
      embed.fields.push({
        name: '🌟 Milestone Bonus',
        value: `+${newLevel * 100} 🪙 • Special achievement unlocked!`,
        inline: false
      });
    }
    
    await channel.send({ embeds: [embed] });
    
    return {
      currencyReward: isMilestone ? currencyReward + (newLevel * 100) : currencyReward,
      premiumReward
    };
  }
};

/**
 * Define what unlocks at each level
 */
function getUnlocksForLevel(level) {
  const unlocks = [];
  
  if (level === 5) unlocks.push('Custom profile color');
  if (level === 10) unlocks.push('Profile badge slot', 'Trading enabled');
  if (level === 15) unlocks.push('Custom title');
  if (level === 20) unlocks.push('Second badge slot', 'Premium shop access');
  if (level === 25) unlocks.push('Voice chat currency boost (2x)');
  if (level === 30) unlocks.push('Create custom counter');
  if (level === 50) unlocks.push('Legendary badge', 'Profile animation');
  if (level === 100) unlocks.push('Hall of Fame entry', 'Custom command');
  
  return unlocks;
}