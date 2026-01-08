const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config/config');
const commandSettingsService = require('../../services/commandSettingsService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('command-settings')
    .setDescription('[ADMIN] Manage command settings and permissions')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View settings for a command')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Command name to view')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all command settings'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable a command globally')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Command name to enable')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable a command globally')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Command name to disable')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('whitelist-add')
        .setDescription('Allow command only in specific channels (whitelist mode)')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Command name')
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to allow command in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('whitelist-remove')
        .setDescription('Remove channel from whitelist')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Command name')
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to remove from whitelist')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('blacklist-add')
        .setDescription('Block command in specific channel')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Command name')
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to block command in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('blacklist-remove')
        .setDescription('Remove channel from blacklist')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Command name')
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to remove from blacklist')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Reset command to default settings')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Command name to reset')
            .setRequired(true))),

  category: 'admin',

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Check if user is admin
      if (interaction.user.id !== process.env.ADMIN_USER_ID) {
        return interaction.editReply({
          content: '❌ This command is only available to administrators.',
          ephemeral: true
        });
      }

      const subcommand = interaction.options.getSubcommand();
      const commandName = interaction.options.getString('command');

      switch (subcommand) {
        case 'view':
          await handleView(interaction, commandName);
          break;
        case 'list':
          await handleList(interaction);
          break;
        case 'enable':
          await handleEnable(interaction, commandName);
          break;
        case 'disable':
          await handleDisable(interaction, commandName);
          break;
        case 'whitelist-add':
          await handleWhitelistAdd(interaction, commandName);
          break;
        case 'whitelist-remove':
          await handleWhitelistRemove(interaction, commandName);
          break;
        case 'blacklist-add':
          await handleBlacklistAdd(interaction, commandName);
          break;
        case 'blacklist-remove':
          await handleBlacklistRemove(interaction, commandName);
          break;
        case 'reset':
          await handleReset(interaction, commandName);
          break;
      }
    } catch (error) {
      console.error('Error in command-settings:', error);
      return interaction.editReply({
        content: '❌ An error occurred while managing command settings.',
        ephemeral: true
      });
    }
  }
};

async function handleView(interaction, commandName) {
  const result = await commandSettingsService.getCommandSettings(commandName);

  if (!result.success) {
    return interaction.editReply({
      content: '❌ Error fetching command settings.',
      ephemeral: true
    });
  }

  const settings = result.settings;

  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle(`⚙️ Settings for /${commandName}`)
    .setTimestamp();

  if (!settings) {
    embed.setDescription('**No custom settings** - Using default settings (enabled everywhere)');
  } else {
    embed.addFields(
      { name: 'Enabled', value: settings.enabled ? '✅ Yes' : '❌ No', inline: true },
      { name: 'Admin Only', value: settings.admin_only ? '✅ Yes' : '❌ No', inline: true },
      { name: 'Mode', value: settings.use_whitelist ? '⚪ Whitelist' : '⚫ Blacklist', inline: true }
    );

    if (settings.use_whitelist && settings.allowed_channel_ids?.length > 0) {
      const channels = settings.allowed_channel_ids.map(id => `<#${id}>`).join(', ');
      embed.addFields({ name: 'Allowed Channels', value: channels });
    } else if (!settings.use_whitelist && settings.blocked_channel_ids?.length > 0) {
      const channels = settings.blocked_channel_ids.map(id => `<#${id}>`).join(', ');
      embed.addFields({ name: 'Blocked Channels', value: channels });
    }
  }

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

async function handleList(interaction) {
  const result = await commandSettingsService.getAllCommandSettings();

  if (!result.success) {
    return interaction.editReply({
      content: '❌ Error fetching command settings.',
      ephemeral: true
    });
  }

  const settings = result.settings;

  if (settings.length === 0) {
    return interaction.editReply({
      content: 'No custom command settings configured. All commands use default settings.',
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle('⚙️ Command Settings')
    .setDescription('Commands with custom settings:')
    .setTimestamp();

  for (const setting of settings) {
    const status = setting.enabled ? '✅' : '❌';
    const mode = setting.use_whitelist ? '⚪ Whitelist' : '⚫ Blacklist';
    const adminOnly = setting.admin_only ? '👑 Admin' : '';

    embed.addFields({
      name: `${status} /${setting.command_name}`,
      value: `${mode} ${adminOnly}`.trim() || 'Default',
      inline: true
    });
  }

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

async function handleEnable(interaction, commandName) {
  const result = await commandSettingsService.enableCommand(commandName);

  if (!result.success) {
    return interaction.editReply({
      content: `❌ Error enabling command: ${result.error}`,
      ephemeral: true
    });
  }

  await interaction.editReply({
    content: `✅ Command \`/${commandName}\` has been **enabled** globally.`,
    ephemeral: true
  });
}

async function handleDisable(interaction, commandName) {
  const result = await commandSettingsService.disableCommand(commandName);

  if (!result.success) {
    return interaction.editReply({
      content: `❌ Error disabling command: ${result.error}`,
      ephemeral: true
    });
  }

  await interaction.editReply({
    content: `✅ Command \`/${commandName}\` has been **disabled** globally.`,
    ephemeral: true
  });
}

async function handleWhitelistAdd(interaction, commandName) {
  const channel = interaction.options.getChannel('channel');
  const result = await commandSettingsService.addToWhitelist(commandName, channel.id);

  if (!result.success) {
    return interaction.editReply({
      content: `❌ Error adding to whitelist: ${result.error}`,
      ephemeral: true
    });
  }

  await interaction.editReply({
    content: `✅ Command \`/${commandName}\` can now **only** be used in whitelisted channels.\nAdded: ${channel}`,
    ephemeral: true
  });
}

async function handleWhitelistRemove(interaction, commandName) {
  const channel = interaction.options.getChannel('channel');
  const result = await commandSettingsService.removeFromWhitelist(commandName, channel.id);

  if (!result.success) {
    return interaction.editReply({
      content: `❌ Error removing from whitelist: ${result.error}`,
      ephemeral: true
    });
  }

  await interaction.editReply({
    content: `✅ Removed ${channel} from whitelist for \`/${commandName}\`.`,
    ephemeral: true
  });
}

async function handleBlacklistAdd(interaction, commandName) {
  const channel = interaction.options.getChannel('channel');
  const result = await commandSettingsService.addToBlacklist(commandName, channel.id);

  if (!result.success) {
    return interaction.editReply({
      content: `❌ Error adding to blacklist: ${result.error}`,
      ephemeral: true
    });
  }

  await interaction.editReply({
    content: `✅ Command \`/${commandName}\` is now **blocked** in ${channel}.`,
    ephemeral: true
  });
}

async function handleBlacklistRemove(interaction, commandName) {
  const channel = interaction.options.getChannel('channel');
  const result = await commandSettingsService.removeFromBlacklist(commandName, channel.id);

  if (!result.success) {
    return interaction.editReply({
      content: `❌ Error removing from blacklist: ${result.error}`,
      ephemeral: true
    });
  }

  await interaction.editReply({
    content: `✅ Removed ${channel} from blacklist for \`/${commandName}\`.`,
    ephemeral: true
  });
}

async function handleReset(interaction, commandName) {
  const result = await commandSettingsService.deleteCommandSettings(commandName);

  if (!result.success) {
    return interaction.editReply({
      content: `❌ Error resetting command: ${result.error}`,
      ephemeral: true
    });
  }

  await interaction.editReply({
    content: `✅ Command \`/${commandName}\` has been reset to default settings (enabled everywhere).`,
    ephemeral: true
  });
}