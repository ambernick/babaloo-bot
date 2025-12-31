// src/dashboard/server.js
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const cors = require('cors');
const Logger = require('../utils/logger');
const db = require('../database/connection');
require('dotenv').config();

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// Trust Railway proxy for secure cookies
app.set('trust proxy', 1);

// Ensure SESSION_SECRET is set
if (!process.env.SESSION_SECRET) {
  Logger.warn('⚠️  SESSION_SECRET not set! Add SESSION_SECRET to your .env file');
}

// Session store setup - try PostgreSQL, fallback to memory
let sessionStore;
try {
  const pgSession = require('connect-pg-simple')(session);
  sessionStore = new pgSession({
    pool: db.pool,
    tableName: 'session',
    createTableIfMissing: true
  });
  Logger.info('Using PostgreSQL session store');
} catch (error) {
  Logger.warn('Using memory store (install connect-pg-simple for persistent sessions)');
  sessionStore = new session.MemoryStore();
}

// Session configuration
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'temporary-dev-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Passport Discord OAuth setup
passport.use(new DiscordStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.DASHBOARD_CALLBACK_URL || 'http://localhost:3000/auth/discord/callback',
  scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
  // Store user info in session
  return done(null, profile);
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

app.use(passport.initialize());
app.use(passport.session());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Auth middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_USER_ID) {
    return next();
  }
  res.status(403).send('Forbidden: Admin access only');
}

// Routes
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/login' }),
  (req, res) => {
    // Redirect admin users to admin panel, regular users to dashboard
    if (req.user.id === process.env.ADMIN_USER_ID) {
      res.redirect('/admin');
    } else {
      res.redirect('/dashboard');
    }
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Dashboard routes (protected)
app.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const userService = require('../services/userService');
    const dbResult = await userService.getOrCreateUser(req.user.id, req.user.username);
    
    if (!dbResult.success) {
      return res.status(500).send('Error loading profile');
    }

    res.render('dashboard', {
      user: req.user,
      dbUser: dbResult.user
    });
  } catch (error) {
    Logger.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// Admin routes (protected + admin check)
app.get('/admin', ensureAuthenticated, ensureAdmin, (req, res) => {
  res.render('admin', { user: req.user });
});

// API routes (for AJAX requests from dashboard)
const apiRouter = require('./routes/api');
app.use('/api', ensureAuthenticated, apiRouter);

// Extension Backend Service (EBS) routes for Twitch Extension
// Enable CORS for Twitch extension domains
const corsOptions = {
  origin: [
    /^https:\/\/[a-z0-9]+\.ext-twitch\.tv$/,  // Twitch extension domains
    'https://twitch.tv',
    'https://www.twitch.tv'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
const extensionRouter = require('./routes/extension');
app.use('/extension', cors(corsOptions), extensionRouter);

// Twitch OAuth routes for account linking
app.get('/auth/twitch/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.TWITCH_OAUTH_CALLBACK_URL
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      Logger.error('Failed to get Twitch access token:', tokenData);
      return res.status(500).send('Failed to authenticate with Twitch');
    }

    // Get Twitch user info
    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID
      }
    });

    const userData = await userResponse.json();

    if (!userData.data || userData.data.length === 0) {
      return res.status(500).send('Failed to get Twitch user data');
    }

    const twitchUser = userData.data[0];
    const twitchId = twitchUser.id;
    const twitchUsername = twitchUser.login;

    // State contains the Discord user ID
    const discordUserId = state;

    // Link the accounts
    const userService = require('../services/userService');
    const linkResult = await userService.linkTwitchAccount(
      parseInt(discordUserId),
      twitchId,
      twitchUsername
    );

    if (linkResult.success) {
      if (linkResult.merged) {
        res.send(`
          <html>
            <head><title>Account Linked!</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>✅ Accounts Linked Successfully!</h1>
              <p>Your Twitch account <strong>${twitchUsername}</strong> has been linked to your Discord account.</p>
              <p>Your Twitch progress has been merged:</p>
              <ul style="list-style: none;">
                <li>💰 +${linkResult.currencyAdded} coins</li>
                <li>⭐ +${linkResult.xpAdded} XP</li>
                <li>🎯 New Level: ${linkResult.newLevel}</li>
              </ul>
              <p>You can close this window and return to Discord.</p>
            </body>
          </html>
        `);
      } else {
        res.send(`
          <html>
            <head><title>Account Linked!</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>✅ Accounts Linked Successfully!</h1>
              <p>Your Twitch account <strong>${twitchUsername}</strong> has been linked to your Discord account.</p>
              <p>Your progress will now sync across both platforms!</p>
              <p>You can close this window and return to Discord.</p>
            </body>
          </html>
        `);
      }
      Logger.success(`Linked Twitch account ${twitchUsername} to Discord user ID ${discordUserId}`);
    } else {
      res.status(400).send(`
        <html>
          <head><title>Link Failed</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Failed to Link Accounts</h1>
            <p>Error: ${linkResult.error}</p>
            <p>You can close this window and try again.</p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    Logger.error('Error in Twitch OAuth callback:', error);
    res.status(500).send('An error occurred while linking your account');
  }
});

// Start server
function startDashboard(client) {
  app.locals.client = client; // Make Discord client accessible in routes

  app.listen(PORT, () => {
    Logger.success(`Dashboard server running on http://localhost:${PORT}`);
  });
}

module.exports = { startDashboard };