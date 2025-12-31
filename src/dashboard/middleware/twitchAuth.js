// src/dashboard/middleware/twitchAuth.js
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify Twitch Extension JWT tokens
 * Twitch sends a JWT in the Authorization header for all extension requests
 */
function verifyTwitchToken(req, res, next) {
  try {
    const token = req.headers['authorization'];

    if (!token || !token.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const jwtToken = token.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT using the Twitch extension secret
    // The secret is base64 encoded, so we need to decode it
    const secret = Buffer.from(process.env.TWITCH_EXTENSION_SECRET, 'base64');

    const decoded = jwt.verify(jwtToken, secret);

    // Extract Twitch user info from the token
    req.twitchUserId = decoded.user_id;
    req.twitchChannelId = decoded.channel_id;
    req.twitchRole = decoded.role; // 'viewer', 'broadcaster', or 'moderator'
    req.twitchOpaqueId = decoded.opaque_user_id; // Used for anonymous users

    next();
  } catch (error) {
    console.error('Twitch JWT verification failed:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware to require broadcaster role
 */
function requireBroadcaster(req, res, next) {
  if (req.twitchRole !== 'broadcaster') {
    return res.status(403).json({ error: 'Broadcaster access required' });
  }
  next();
}

/**
 * Middleware to require broadcaster or moderator role
 */
function requireModOrBroadcaster(req, res, next) {
  if (req.twitchRole !== 'broadcaster' && req.twitchRole !== 'moderator') {
    return res.status(403).json({ error: 'Moderator or broadcaster access required' });
  }
  next();
}

module.exports = {
  verifyTwitchToken,
  requireBroadcaster,
  requireModOrBroadcaster
};