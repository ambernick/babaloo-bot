// src/events/interactionCreate.js
const Logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  
  async execute(interaction, client) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        Logger.warn(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        Logger.command(interaction.user.tag, interaction.commandName);
        await command.execute(interaction);
      } catch (error) {
        Logger.error(`Error executing ${interaction.commandName}:`, error);
        
        const errorMessage = {
          content: '❌ There was an error executing that command!',
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }
    
    // Handle button interactions (for future shop/trading system)
    else if (interaction.isButton()) {
      // Button handler logic will go here
      Logger.info(`Button pressed: ${interaction.customId} by ${interaction.user.tag}`);
    }
    
    // Handle select menu interactions
    else if (interaction.isStringSelectMenu()) {
      // Select menu handler logic will go here
      Logger.info(`Select menu used: ${interaction.customId} by ${interaction.user.tag}`);
    }

    // Handle modals (for future forms/input)
    else if (interaction.isModalSubmit()) {
      // Modal handler logic will go here
      Logger.info(`Modal submitted: ${interaction.customId} by ${interaction.user.tag}`);
    }
  }
};