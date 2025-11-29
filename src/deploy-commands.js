// src/deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Logger = require('./utils/logger');

const commands = [];
const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));

// Load all commands and build JSON for Discord API
for (const folder of commandFolders) {
  const commandPath = path.join(__dirname, 'commands', folder);
  const commandFiles = fs.readdirSync(commandPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const command = require(path.join(commandPath, file));
    if (command.data) {
      commands.push(command.data.toJSON());
      Logger.info(`Loaded slash command: ${command.data.name}`);
    }
  }
}

// Deploy commands to Discord
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    Logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    // Guild commands (instant updates, use for development)
    if (process.env.GUILD_ID) {
      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      Logger.success(`Successfully reloaded ${data.length} guild commands.`);
    } else {
      // Global commands (takes up to 1 hour to propagate, use for production)
      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      Logger.success(`Successfully reloaded ${data.length} global commands.`);
    }
  } catch (error) {
    Logger.error('Error deploying commands:', error);
  }
})();