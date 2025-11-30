// src/dashboard/server.js
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const Logger = require('../utils/logger');
require('dotenv').config();

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
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
    res.redirect('/dashboard');
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

// Start server
function startDashboard(client) {
  app.locals.client = client; // Make Discord client accessible in routes
  
  app.listen(PORT, () => {
    Logger.success(`Dashboard server running on http://localhost:${PORT}`);
  });
}

module.exports = { startDashboard };