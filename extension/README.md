# Babaloo Bot - Twitch Extension

This is a Twitch Panel Extension that allows viewers to see their balance, browse the shop, and redeem rewards using the same economy system as Discord.

## Features

- **Shared Economy**: Currency syncs between Discord and Twitch when accounts are linked
- **Shop System**: Channel points-style redemptions with customizable rewards
- **Redemption Management**: Track redemption history and status
- **Account Linking**: Merge Twitch and Discord progress
- **Mobile Support**: Panel extension works on mobile Twitch app

## Files

- `panel/panel.html` - Extension UI structure
- `panel/panel.css` - Styling (Twitch-themed dark mode)
- `panel/panel.js` - Logic and EBS communication

## Setup Instructions

### 1. Register Extension on Twitch

1. Go to https://dev.twitch.tv/console/extensions
2. Click "Create Extension"
3. Fill in:
   - **Name**: Babaloo Bot
   - **Extension Type**: Panel
   - **Author Name**: Your name
   - **Support Email**: Your email
4. Click "Create"

### 2. Configure Extension

1. **Asset Hosting**:
   - Go to "Files" tab
   - Upload `panel.html`, `panel.css`, and `panel.js`
   - Or use your own CDN/hosting

2. **Extension Capabilities**:
   - Enable "Request Identity Link"
   - This allows the extension to access the viewer's Twitch ID

3. **Extension Secret** (for JWT verification):
   - Go to "Settings" tab
   - Copy the "Extension Secret" (base64 encoded)
   - Add to your `.env` file:
     ```
     TWITCH_EXTENSION_SECRET=your_extension_secret_here
     ```

4. **Viewer Panel**:
   - Go to "Views" tab
   - Set "Panel Viewer Path" to `panel.html`
   - Set panel height: 300px (recommended)

5. **Allowlist** (for EBS communication):
   - Go to "Settings" tab
   - Add your EBS URL to the allowlist:
     - `https://babaloo-bot-production.up.railway.app`
     - (Or your custom domain)

### 3. Update Extension Configuration

Edit `panel/panel.js` and update the EBS_URL:

```javascript
const EBS_URL = 'https://your-railway-url.up.railway.app';
```

### 4. Test Extension

1. Go to "Developer Rig" tab or download Twitch Developer Rig
2. Load your extension
3. Test with a Twitch account

### 5. Submit for Review

1. Fill in all required information (Privacy Policy, Terms of Service, etc.)
2. Upload screenshots and description
3. Submit for Twitch review
4. Wait for approval (usually 1-2 weeks)

### 6. Activate on Your Channel

Once approved:

1. Go to your Twitch Creator Dashboard
2. Click "Extensions"
3. Find "Babaloo Bot" and click "Install"
4. Activate it as a Panel extension
5. Your viewers will see it below your stream!

## How It Works

### For Viewers

1. **First Time**:
   - Viewers see "Account Not Linked" message
   - They type `!link` in Twitch chat
   - Bot creates their account and links it to Twitch ID

2. **Using the Extension**:
   - View balance (coins, gems, level)
   - Browse shop items
   - Redeem rewards by clicking items
   - Check redemption history

3. **Linking Discord** (Optional):
   - Use `/link-twitch` command in Discord
   - Progress merges from both platforms

### For Admins

-  Create shop items in the admin dashboard
- Manage pending redemptions
- Fulfill or refund redemptions
- Track redemption analytics

## API Endpoints

The extension communicates with these EBS endpoints:

- `GET /extension/user` - Get user profile and balance
- `GET /extension/shop` - Get all shop items
- `POST /extension/shop/:id/redeem` - Redeem an item
- `GET /extension/redemptions` - Get redemption history
- `GET /extension/shop/:id/can-redeem` - Check if user can redeem

All requests require Twitch JWT authentication.

## Security

- All requests use Twitch-signed JWTs
- Extension Secret is kept secure (never in frontend code)
- EBS validates all tokens before processing
- CORS properly configured for Twitch domains

## Troubleshooting

**Extension shows "Loading..." forever**:
- Check browser console for errors
- Verify EBS_URL is correct in `panel.js`
- Ensure EBS is running and accessible

**"Account Not Linked" but user has typed !link**:
- Check bot logs for errors
- Verify Twitch ID is being stored correctly
- Try unlinking and relinking

**Redemption fails**:
- Check user has enough currency
- Check item stock is not 0
- Check for cooldown restrictions
- View Railway logs for backend errors

## Development

To test locally:

1. Start the EBS server:
   ```bash
   npm start
   ```

2. Use Twitch Developer Rig to load extension

3. Point EBS_URL to `http://localhost:3000` (only works in Developer Rig)

## Production

- Host extension files on CDN or Twitch's servers
- Use production Railway URL for EBS_URL
- Enable HTTPS (required by Twitch)
- Monitor logs for errors

## Support

For issues or questions:
- GitHub: https://github.com/ambernick/babaloo-bot/issues
- Discord: (your server)