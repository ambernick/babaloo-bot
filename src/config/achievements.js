// src/config/achievements.js
/**
 * Achievement definitions with trigger conditions
 * This makes it easy to add new achievements without touching database
 */

module.exports = {
    // Starter achievements
    FIRST_STEPS: {
      name: 'First Steps',
      description: 'Send your first message',
      category: 'starter',
      reward_currency: 10,
      reward_xp: 25,
      rarity: 'common',
      checkCondition: (stats) => stats.message_count >= 1
    },
    
    CHATTEBOX: {
      name: 'Chatterbox',
      description: 'Send 100 messages',
      category: 'engagement',
      reward_currency: 50,
      reward_xp: 100,
      rarity: 'common',
      checkCondition: (stats) => stats.message_count >= 100
    },
    
    SOCIAL_BUTTERFLY: {
      name: 'Social Butterfly',
      description: 'Send 500 messages',
      category: 'engagement',
      reward_currency: 200,
      reward_xp: 300,
      rarity: 'uncommon',
      checkCondition: (stats) => stats.message_count >= 500
    },
    
    CONVERSATION_MASTER: {
      name: 'Conversation Master',
      description: 'Send 1000 messages',
      category: 'engagement',
      reward_currency: 500,
      reward_xp: 750,
      rarity: 'rare',
      checkCondition: (stats) => stats.message_count >= 1000
    },
    
    // Level achievements
    LEVEL_5: {
      name: 'Rising Star',
      description: 'Reach level 5',
      category: 'milestone',
      reward_currency: 100,
      reward_xp: 0,
      rarity: 'uncommon',
      checkCondition: (stats) => stats.level >= 5
    },
    
    LEVEL_10: {
      name: 'Dedicated Member',
      description: 'Reach level 10',
      category: 'milestone',
      reward_currency: 250,
      reward_premium_currency: 1,
      reward_xp: 0,
      rarity: 'uncommon',
      checkCondition: (stats) => stats.level >= 10
    },
    
    LEVEL_25: {
      name: 'Community Pillar',
      description: 'Reach level 25',
      category: 'milestone',
      reward_currency: 500,
      reward_premium_currency: 3,
      reward_xp: 0,
      rarity: 'rare',
      checkCondition: (stats) => stats.level >= 25
    },
    
    LEVEL_50: {
      name: 'Legend',
      description: 'Reach level 50',
      category: 'milestone',
      reward_currency: 1000,
      reward_premium_currency: 10,
      reward_xp: 0,
      rarity: 'epic',
      checkCondition: (stats) => stats.level >= 50
    },
    
    // Account achievements
    LINK_UP: {
      name: 'Link Up',
      description: 'Connect Discord and Twitch accounts',
      category: 'account',
      reward_currency: 200,
      reward_premium_currency: 2,
      reward_xp: 200,
      rarity: 'rare',
      checkCondition: (stats) => stats.has_twitch_linked
    },
    
    // Daily achievements
    EARLY_BIRD: {
      name: 'Early Bird',
      description: 'Claim daily bonus 7 days in a row',
      category: 'special',
      reward_currency: 150,
      reward_xp: 150,
      rarity: 'uncommon',
      checkCondition: (stats) => stats.daily_streak >= 7
    },
    
    DEDICATED: {
      name: 'Dedicated',
      description: 'Claim daily bonus 30 days in a row',
      category: 'special',
      reward_currency: 500,
      reward_premium_currency: 5,
      reward_xp: 500,
      rarity: 'epic',
      checkCondition: (stats) => stats.daily_streak >= 30
    },
    
    // Economy achievements
    WEALTHY: {
      name: 'Wealthy',
      description: 'Accumulate 5,000 currency',
      category: 'economy',
      reward_currency: 250,
      reward_xp: 200,
      rarity: 'uncommon',
      checkCondition: (stats) => stats.currency >= 5000
    },
    
    BIG_SPENDER: {
      name: 'Big Spender',
      description: 'Spend 1,000 currency',
      category: 'economy',
      reward_currency: 150,
      reward_xp: 150,
      rarity: 'uncommon',
      checkCondition: (stats) => stats.total_spent >= 1000
    },
    
    GENEROUS: {
      name: 'Generous Soul',
      description: 'Gift an item to another user',
      category: 'social',
      reward_currency: 50,
      reward_xp: 75,
      rarity: 'common',
      checkCondition: (stats) => stats.gifts_sent >= 1
    },
    
    // Collector achievements
    COLLECTOR: {
      name: 'Collector',
      description: 'Own 10 different items',
      category: 'inventory',
      reward_currency: 200,
      reward_xp: 200,
      rarity: 'rare',
      checkCondition: (stats) => stats.unique_items >= 10
    },
    
    HOARDER: {
      name: 'Hoarder',
      description: 'Own 50 items total',
      category: 'inventory',
      reward_currency: 400,
      reward_premium_currency: 2,
      reward_xp: 300,
      rarity: 'epic',
      checkCondition: (stats) => stats.total_items >= 50
    }
  };