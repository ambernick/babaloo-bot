// src/services/voiceTracker.js
const userService = require('./userService');
const currencyService = require('./currencyService');
const xpService = require('./xpService');
const levelUpHandler = require('../events/levelUp');
const settingsService = require('./settingsService');

class VoiceTracker {
  constructor() {
    this.voiceSessions = new Map(); // userId -> { joinTime, lastReward }
    this.checkInterval = null;
  }

  /**
   * Start the voice tracker
   */
  start(client) {
    this.client = client;

    // Check every minute for users in voice channels
    this.checkInterval = setInterval(() => {
      this.checkVoiceUsers();
    }, 60000); // Every 60 seconds

    console.log('✅ Voice tracker started');
  }

  /**
   * Stop the voice tracker
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.voiceSessions.clear();
    console.log('Voice tracker stopped');
  }

  /**
   * Handle user joining voice channel
   */
  async handleVoiceJoin(member, channel) {
    const userId = member.user.id;
    const username = member.user.username;

    // Don't track bots
    if (member.user.bot) return;

    // Don't track AFK channels
    if (channel.guild.afkChannelId && channel.id === channel.guild.afkChannelId) {
      return;
    }

    const now = Date.now();

    // Record join time
    this.voiceSessions.set(userId, {
      joinTime: now,
      lastReward: now,
      username,
      channelName: channel.name
    });

    console.log(`👤 ${username} joined voice channel: ${channel.name}`);
  }

  /**
   * Handle user leaving voice channel
   */
  async handleVoiceLeave(member) {
    const userId = member.user.id;

    if (this.voiceSessions.has(userId)) {
      const session = this.voiceSessions.get(userId);
      const duration = Math.floor((Date.now() - session.joinTime) / 1000 / 60); // minutes

      console.log(`👤 ${member.user.username} left voice after ${duration} minutes`);

      this.voiceSessions.delete(userId);
    }
  }

  /**
   * Check all users currently in voice channels and award rewards
   */
  async checkVoiceUsers() {
    if (!this.client) return;

    const now = Date.now();

    // Get settings from database
    const settings = await settingsService.getSettings([
      'voice_minute_xp',
      'voice_minute_currency'
    ]);

    const xpPerMinute = settings.voice_minute_xp || 3;
    const currencyPerMinute = settings.voice_minute_currency || 2;

    // Iterate through all voice sessions
    for (const [userId, session] of this.voiceSessions.entries()) {
      try {
        // Check if at least 1 minute has passed since last reward
        const timeSinceLastReward = (now - session.lastReward) / 1000 / 60; // minutes

        if (timeSinceLastReward >= 1) {
          // Get or create user
          const userResult = await userService.getOrCreateUser(userId, session.username);

          if (!userResult.success) {
            console.error('Error getting user for voice tracking:', userResult.error);
            continue;
          }

          const user = userResult.user;

          // Award currency and XP
          await currencyService.awardCurrency(
            user.id,
            currencyPerMinute,
            'voice',
            `Voice chat: ${session.channelName}`
          );

          const xpResult = await xpService.awardXP(user.id, xpPerMinute, 'voice');

          // Update last reward time
          session.lastReward = now;

          // Handle level-up
          if (xpResult.success && xpResult.leveledUp) {
            console.log(`🎉 ${session.username} leveled up to ${xpResult.newLevel} from voice chat!`);

            // Try to find the user in a guild to send level-up notification
            try {
              const guilds = this.client.guilds.cache;
              for (const guild of guilds.values()) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                  // Find a channel to send the level-up message
                  const voiceChannel = member.voice.channel;
                  if (voiceChannel) {
                    // Try to find a text channel associated with the voice channel
                    const textChannel = guild.channels.cache.find(
                      ch => ch.type === 0 && ch.permissionsFor(guild.members.me).has('SendMessages')
                    );

                    if (textChannel) {
                      const rewards = await levelUpHandler.announce(
                        textChannel,
                        member.user,
                        xpResult.oldLevel,
                        xpResult.newLevel,
                        this.client
                      );

                      // Award level-up rewards
                      await currencyService.awardCurrency(
                        user.id,
                        rewards.currencyReward,
                        'level_up',
                        `Level up to ${xpResult.newLevel}`
                      );

                      if (rewards.premiumReward > 0) {
                        if (typeof currencyService.awardPremiumCurrency === 'function') {
                          await currencyService.awardPremiumCurrency(
                            user.id,
                            rewards.premiumReward,
                            'level_up',
                            `Level ${xpResult.newLevel} milestone`
                          );
                        }
                      }

                      // Check achievements
                      const achievementService = require('./achievementService');
                      const newAchievements = await achievementService.autoCheckAchievements(user.id);

                      if (newAchievements && newAchievements.length > 0) {
                        for (const ach of newAchievements) {
                          await achievementService.announceAchievement(textChannel, member.user, ach, this.client);
                        }
                      }
                    }
                  }
                  break;
                }
              }
            } catch (error) {
              console.error('Error sending voice level-up notification:', error);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing voice rewards for user ${userId}:`, error);
      }
    }
  }

  /**
   * Initialize tracking for all users currently in voice channels
   */
  async initializeExistingUsers(client) {
    this.client = client;
    const now = Date.now();

    for (const guild of client.guilds.cache.values()) {
      for (const member of guild.members.cache.values()) {
        if (member.voice.channel && !member.user.bot) {
          const channel = member.voice.channel;

          // Skip AFK channels
          if (guild.afkChannelId && channel.id === guild.afkChannelId) {
            continue;
          }

          this.voiceSessions.set(member.user.id, {
            joinTime: now,
            lastReward: now,
            username: member.user.username,
            channelName: channel.name
          });

          console.log(`👤 Tracking existing voice user: ${member.user.username} in ${channel.name}`);
        }
      }
    }
  }

  /**
   * Get current voice session stats
   */
  getStats() {
    const sessions = [];
    const now = Date.now();

    for (const [userId, session] of this.voiceSessions.entries()) {
      const duration = Math.floor((now - session.joinTime) / 1000 / 60);
      sessions.push({
        userId,
        username: session.username,
        channelName: session.channelName,
        durationMinutes: duration
      });
    }

    return sessions;
  }
}

module.exports = new VoiceTracker();
