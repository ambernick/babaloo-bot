# Twitch Bot Setup Guide

This guide walks you through enabling Twitch integration for Babaloo Bot.

## Prerequisites

- A Twitch account for your bot (can be the same as your main account, or create a separate bot account)
- Your bot needs to be a moderator in channels where it will operate (optional but recommended)

## Step 1: Get a Twitch OAuth Token

### Option A: Using Twitch Token Generator (Recommended for Testing)

1. Visit https://twitchtokengenerator.com/
2. Click **"Custom Scope Token"**
3. Select the following scopes:
   - `chat:read` - Read chat messages
   - `chat:edit` - Send chat messages
4. Click **"Generate Token"**
5. Copy the **Access Token** (it will start with `oauth:...`)
6. **IMPORTANT**: Save this token securely - you won't be able to see it again

### Option B: Using Twitch CLI (For Production)

```bash
# Install Twitch CLI
brew install twitch

# Configure CLI
twitch configure

# Generate token with required scopes
twitch token -u -s 'chat:read chat:edit'
```

### Option C: Create Your Own OAuth App (Most Secure)

1. Go to https://dev.twitch.tv/console/apps
2. Click **"Register Your Application"**
3. Fill in:
   - Name: "Babaloo Bot"
   - OAuth Redirect URLs: `http://localhost:3000`
   - Category: Chat Bot
4. Save the **Client ID** and **Client Secret**
5. Implement full OAuth flow (see Twitch API docs)

## Step 2: Configure Environment Variables

### For Local Development

Add to `.env.dev`:

```bash
TWITCH_BOT_USERNAME=your_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_token_here
TWITCH_CHANNELS=falsettovibrato
```

### For Railway (Production/Dev)

1. Go to Railway project → Your service → **Variables** tab
2. Add these variables:
   - `TWITCH_BOT_USERNAME` = `your_bot_username`
   - `TWITCH_OAUTH_TOKEN` = `oauth:your_token_here`
   - `TWITCH_CHANNELS` = `falsettovibrato` (or comma-separated: `channel1,channel2`)

## Step 3: Test the Integration

### Local Testing

1. Make sure variables are set in `.env.dev`
2. Run: `npm run start:dev`
3. Check logs for:
   ```
   ✅ Twitch bot connected to channels: falsettovibrato
   Twitch bot integration enabled
   ```

### Railway Testing

1. Set variables in Railway
2. Redeploy or wait for auto-deploy
3. Check Railway logs for the same success messages

## Step 4: Verify It Works

1. Open your Twitch channel in a browser
2. Type a message in chat (from a different account)
3. Check that:
   - User earns currency and XP (check with `/balance` on Discord if they have a linked account)
   - Bot responds to level ups in Twitch chat
   - No errors in logs

## Troubleshooting

### Bot Not Connecting

- **Error: "Login authentication failed"**
  - Token is invalid or expired
  - Regenerate token and update environment variables

- **Error: "RECONNECT"**
  - Twitch is restarting the connection (this is normal)
  - Bot will auto-reconnect

### Bot Connected but Not Tracking Messages

- **Messages from bot itself are ignored** (working as intended)
- **Commands starting with `!` are ignored** (working as intended)
- **Rate limiting active**: Users earn 1 coin/minute, max 60/hour

### Bot Not Announcing Level Ups

- Check Railway logs for errors
- Verify bot has permission to send messages in the channel
- Make user earned enough XP to level up (2 XP per message)

## Features

Once enabled, the Twitch bot will:

✅ Track chat messages from Twitch users
✅ Award 1 coin per minute of chatting (max 60/hour)
✅ Award 2 XP per qualifying message
✅ Announce level ups in Twitch chat
✅ Auto-register new Twitch users to the bot
✅ Share economy with Discord (same currency/XP system)

## Future Features

🔮 Account linking (link Discord ↔ Twitch)
🔮 Twitch-specific commands (`!balance`, `!rank`)
🔮 Twitch subscriber benefits
🔮 Twitch bit/subscription tracking
🔮 Channel point integrations

## Security Best Practices

1. **Never commit OAuth tokens to git**
   - Tokens are in `.env.dev` which is gitignored
   - Only set tokens in Railway environment variables

2. **Use separate bot account**
   - Create a dedicated Twitch account for the bot
   - Don't use your main Twitch account

3. **Rotate tokens regularly**
   - Regenerate tokens every 60-90 days
   - Update Railway variables after rotation

4. **Limit channel access**
   - Only add channels you moderate
   - Remove channels from `TWITCH_CHANNELS` if bot is no longer needed

## Disabling Twitch Integration

To disable Twitch without removing the code:

1. **Local**: Comment out the variables in `.env.dev`
2. **Railway**: Delete the `TWITCH_BOT_USERNAME` variable

The bot will detect missing credentials and skip Twitch initialization.

## Support

If you encounter issues:
1. Check Railway logs for error messages
2. Verify token scopes are correct (`chat:read`, `chat:edit`)
3. Ensure bot account isn't banned/suspended on Twitch
4. Check Twitch dev console for API status: https://devstatus.twitch.tv/
