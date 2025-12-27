# Twitch OAuth Account Linking Setup

This guide will help you set up Twitch OAuth for secure account linking between Discord and Twitch.

## Step 1: Register Your Twitch Application

1. Go to the **Twitch Developer Console**: https://dev.twitch.tv/console/apps

2. Click **"Register Your Application"**

3. Fill in the following details:
   - **Name**: `Babaloo Bot` (or any name you prefer)
   - **OAuth Redirect URLs**:
     - For development: `http://localhost:3001/auth/twitch/callback`
     - For production: `https://yourdomain.com/auth/twitch/callback` (when you deploy)
   - **Category**: Select `Application Integration` or `Chat Bot`

4. Click **"Create"**

5. Click **"Manage"** on your newly created application

6. **Copy the Client ID** - you'll need this

7. Click **"New Secret"** to generate a Client Secret

8. **Copy the Client Secret** - you'll only see this once!

## Step 2: Update Your Environment Variables

### Development (.env.dev):

Add these lines to your `.env.dev` file:

```bash
# Twitch OAuth (for account linking)
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here
TWITCH_OAUTH_CALLBACK_URL=http://localhost:3001/auth/twitch/callback
```

Replace `your_client_id_here` and `your_client_secret_here` with the values you copied.

### Production:

When deploying to Railway, add these environment variables:

```bash
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here
TWITCH_OAUTH_CALLBACK_URL=https://yourdomain.com/auth/twitch/callback
```

**Important**: Update the callback URL to match your production domain.

## Step 3: Test the OAuth Flow

1. **Start your bot** (should already be running):
   ```bash
   npm run start:dev
   ```

2. **In Discord**, run the command:
   ```
   /link-twitch
   ```

3. You'll receive a message with a **"Link Twitch Account"** button

4. Click the button - it will open Twitch in your browser

5. **Log in to Twitch** (if not already logged in)

6. Click **"Authorize"** to allow the bot to verify your account

7. You'll be redirected to a success page showing:
   - ✅ Accounts Linked Successfully!
   - Your Twitch username
   - Any merged progress (if you had a Twitch-only account)

8. Close the browser tab and return to Discord

9. Run `/profile` in Discord to verify your Twitch account is linked!

## How It Works

1. User runs `/link-twitch` on Discord
2. Bot generates a unique Twitch OAuth URL with the user's database ID
3. User clicks the link and authorizes on Twitch
4. Twitch redirects back to your bot with an authorization code
5. Bot exchanges the code for an access token
6. Bot fetches the user's Twitch ID and username
7. Bot links the accounts in the database
8. If the user had existing Twitch progress, it gets merged!

## Benefits

✅ **Verified** - Twitch confirms they own the account
✅ **Secure** - Uses official OAuth 2.0 protocol
✅ **No chat clutter** - Everything happens via web browser
✅ **Simple UX** - Just click a button and authorize
✅ **Automatic merging** - Existing progress is preserved

## Troubleshooting

### "Failed to authenticate with Twitch"

- Check that your `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` are correct
- Make sure the callback URL in your Twitch app matches `TWITCH_OAUTH_CALLBACK_URL`

### "Account already linked"

- The Discord account is already linked to a Twitch account
- Contact an administrator if you need to unlink and relink

### Bot says "Twitch OAuth is not configured"

- Make sure you've set `TWITCH_CLIENT_ID` and `TWITCH_OAUTH_CALLBACK_URL` in your `.env.dev` file
- Restart the bot after adding the environment variables

## Security Notes

- Never commit your `.env` files to git
- Keep your `TWITCH_CLIENT_SECRET` confidential
- The bot only requests `user:read:email` scope (minimal permissions)
- Users can revoke access anytime at: https://www.twitch.tv/settings/connections

## Next Steps

Once you've tested locally, update your production environment on Railway with the Twitch OAuth credentials and production callback URL.
