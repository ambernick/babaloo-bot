# CLAUDE.md

# Project Overview

Babaloo Bot is a multi-platform community engagement system for the falsettovibrato brand. It provides gamification across Discord and Twitch with a shared economy, achievement system, XP/leveling, and cross-platform account linking. The bot uses Discord.js v14 with slash commands, PostgreSQL for data persistence, and is designed to eventually integrate with Shopify, custom games, and social media platforms.

This is a Discord-first bot with Twitch integration planned. The primary user flow is: users chat → earn currency/XP → level up → unlock achievements → spend currency in shop → customize profiles.

# Non-Goals

- This is NOT a public multi-guild bot. It is purpose-built for a single community.
- This does NOT use prefix commands (`!command`). All interactions are slash commands.
- This does NOT support multiple currencies per user beyond regular currency and premium currency.
- This does NOT implement real-time voice activity tracking in MVP (planned for Phase 6).
- This does NOT use external gamification platforms or SaaS solutions.
- This is NOT a general-purpose moderation bot.

# Tech Stack

**Runtime & Language:**
- Node.js v20+
- JavaScript (no TypeScript currently, though TypeScript was mentioned in architecture docs)

**Core Dependencies:**
- discord.js v14.24.2 (Discord API interactions)
- pg v8.16.3 (PostgreSQL client)
- dotenv v17.2.3 (environment variable management)

**Planned Dependencies (not yet implemented):**
- tmi.js (Twitch chat integration)
- express.js (web dashboard API)
- express-session, passport, passport-discord (OAuth/dashboard auth)
- ejs (dashboard views)

**Database:**
- PostgreSQL (hosted on Railway.app or similar)

**Deployment:**
- Railway.app or Render.com (planned)

# Architecture

**Structure:**
```
babaloo-bot/
├── src/
│   ├── commands/        # Slash command definitions organized by category
│   │   ├── economy/     # Currency, daily, balance, rank commands
│   │   ├── profile/     # Profile, achievements commands
│   │   └── utility/     # Ping, help, stats, serverinfo, userinfo
│   ├── events/          # Discord event handlers (ready, messageCreate, interactionCreate, levelUp)
│   ├── services/        # Business logic layer (userService, currencyService, xpService, achievementService, chatTracker)
│   ├── database/        # Database connection, schema, initialization
│   ├── config/          # Configuration files (config.js, achievements.js)
│   ├── utils/           # Utilities (logger.js)
│   └── dashboard/       # Web dashboard (not yet implemented)
├── index.js             # Entry point
└── package.json
```

**Command System:**
- All commands are slash commands using Discord.js SlashCommandBuilder
- Commands must have a `data` property (SlashCommandBuilder) and `execute` function
- Commands must specify a `category` property for organization
- Commands are auto-loaded from `src/commands/` subfolders

**Event System:**
- Events are auto-loaded from `src/events/`
- Each event exports `name`, optional `once`, and `execute` function
- Key events: `clientReady`, `interactionCreate`, `messageCreate`

**Service Layer:**
- All database operations go through services
- Services return objects with `{ success: boolean, ... }` structure
- Services handle errors and return user-friendly error messages

# Data & Domain Model

**Core Entities:**

**users** (Primary entity)
- `id` (SERIAL PRIMARY KEY)
- `discord_id` (VARCHAR(20) UNIQUE) - Discord snowflake ID
- `twitch_id` (VARCHAR(20) UNIQUE) - Twitch user ID (nullable, for future linking)
- `username` (VARCHAR(50))
- `currency` (INTEGER DEFAULT 0) - Regular currency (coins 🪙)
- `premium_currency` (INTEGER DEFAULT 0) - Premium currency (gems 💎)
- `xp` (INTEGER DEFAULT 0) - Total experience points
- `level` (INTEGER DEFAULT 1) - Calculated from XP
- `created_at`, `updated_at` (TIMESTAMP)

**user_profiles** (1:1 with users)
- `user_id` (FK to users, PRIMARY KEY)
- `title`, `color`, `badge`, `bio` - Customization fields
- `streak_days` - Daily bonus streak
- `last_active` - Last activity timestamp
- `customization_json` (JSONB) - Extensible customization data

**achievements** (Predefined achievements)
- `id` (SERIAL PRIMARY KEY)
- `name` (VARCHAR(100) UNIQUE)
- `description`, `category`
- `reward_currency`, `reward_premium_currency`, `reward_xp`
- `rarity` (common, uncommon, rare, epic, legendary)
- `icon_url`, `hidden` (BOOLEAN)

**user_achievements** (User progress on achievements)
- `id` (SERIAL PRIMARY KEY)
- `user_id` (FK to users)
- `achievement_id` (FK to achievements)
- `progress`, `required` - Progress tracking
- `completed_at` (TIMESTAMP, NULL if incomplete)
- UNIQUE(user_id, achievement_id)

**transactions** (All currency movements)
- `id` (SERIAL PRIMARY KEY)
- `user_id` (FK to users)
- `type` (earn/spend)
- `category` (chat, daily, achievement, etc.)
- `amount` (INTEGER)
- `currency_type` (regular/premium)
- `description` (TEXT)
- `created_at` (TIMESTAMP)

**Invariants:**
- Users are auto-created on first message/interaction (no explicit registration)
- Level is calculated from XP: `level = floor(sqrt(xp / 100)) + 1`
- XP for level N: `(N - 1)^2 * 100`
- Currency cannot go negative
- Daily bonus can only be claimed once per 24 hours
- Chat earnings are rate-limited: 1 currency/minute, max 60/hour

# Key Constraints

**Rate Limits:**
- Chat currency earning: 1 coin per minute per user, max 60 coins/hour
- Daily bonus: Once per 24 hours per user
- XP from chat: 2 XP per qualifying message

**Database:**
- PostgreSQL connection pooling via `pg` module
- All queries use parameterized statements (no raw SQL with string interpolation)
- `updated_at` is auto-updated via PostgreSQL trigger

**Discord API:**
- All commands defer replies immediately to avoid 3-second timeout
- Use `interaction.deferReply()` then `interaction.editReply()`
- Embeds use color codes from `config.colors`

**Business Rules:**
- Admin user (from `ADMIN_USER_ID` env var) excluded from leaderboards
- Achievements are auto-checked after XP/currency changes
- Level-up triggers achievement checks and announcements
- Transaction log is append-only (no deletions)

# Coding Standards

**Command Structure:**
```javascript
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('Description'),
  category: 'categoryname', // Required
  
  async execute(interaction, client) {
    await interaction.deferReply(); // Always defer first
    
    try {
      // Command logic
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in commandname:', error);
      await interaction.editReply('❌ Error message');
    }
  }
};
```

**Service Pattern:**
```javascript
class SomeService {
  async someMethod(userId, amount) {
    try {
      const result = await db.query('...', [userId, amount]);
      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error('Error in someMethod:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SomeService(); // Singleton export
```

**Logging:**
- Use `Logger` utility from `src/utils/logger.js`
- `Logger.success()` for successful operations
- `Logger.info()` for general info
- `Logger.error(message, error)` for errors
- `Logger.command(username, commandName)` for command usage

**Embed Colors:**
- Use `config.colors.primary` (purple) for general info
- Use `config.colors.success` (green) for success messages
- Use `config.colors.error` (red) for errors
- Use `config.colors.warning` (orange) for warnings
- Use `config.colors.info` (blue) for informational embeds

**Naming Conventions:**
- Slash commands: lowercase, no spaces (e.g., `serverinfo`, not `server-info`)
- Service methods: camelCase
- Database columns: snake_case
- Files: camelCase for JS, lowercase for folders

# Security & Compliance

**Environment Variables (Required):**
- `DISCORD_TOKEN` - Bot token from Discord Developer Portal
- `CLIENT_ID` - Discord application ID
- `DATABASE_URL` - PostgreSQL connection string
- `ADMIN_USER_ID` - Discord ID of bot admin
- `NODE_ENV` - 'production' or 'development'

**Optional (for dashboard):**
- `DASHBOARD_PORT`, `SESSION_SECRET`, `CLIENT_SECRET`, `DASHBOARD_CALLBACK_URL`

**Security Rules:**
- Never commit `.env` file (in `.gitignore`)
- All database queries use parameterized statements
- No raw user input concatenated into SQL
- Admin-only commands check `req.user.id === process.env.ADMIN_USER_ID`
- Dashboard routes require authentication via `ensureAuthenticated` middleware

**OAuth (Planned):**
- Discord OAuth2 for dashboard login
- Twitch OAuth2 for account linking
- Sessions stored in memory (express-session)

# Performance & Scalability

**Current Bottlenecks:**
- Chat tracking runs on every message (mitigated by rate limiting)
- Achievement auto-checking on every XP/currency change
- No caching layer (all data fetched from PostgreSQL)

**Optimizations:**
- Hourly earning limits tracked in-memory (`chatTracker.messagesThisHour` Map)
- Last message time tracked in-memory (`chatTracker.lastMessageTime` Map)
- Hourly data cleaned periodically (1% chance per message)

**Database Indexes (from schema.sql):**
- `idx_users_discord` on `users(discord_id)`
- `idx_users_twitch` on `users(twitch_id)`
- `idx_transactions_user` on `transactions(user_id, created_at DESC)`
- `idx_leaderboard_category` on `leaderboard_cache(category, rank)`

**Scaling Assumptions:**
- Single Discord server (not multi-guild)
- Estimated <10k users
- Estimated <100 concurrent chatters
- Database hosted externally (Railway.app)

# Current State

**Implemented (Phase 1 Complete):**
- ✅ Bot infrastructure with slash commands
- ✅ Command handler (auto-loads from folders)
- ✅ Event handler (auto-loads events)
- ✅ PostgreSQL database connection
- ✅ Complete database schema (users, achievements, transactions, etc.)
- ✅ User service (auto-registration, getOrCreateUser)
- ✅ Currency service (award, spend, getBalance, claimDaily)
- ✅ XP service (award, level calculation, progress tracking)
- ✅ Achievement service (initialization, auto-checking, announcements)
- ✅ Chat tracker (currency/XP earning from messages)
- ✅ Level-up event handler with rewards and unlocks
- ✅ Logger utility

**Implemented (Phase 2 Partial):**
- ✅ Achievement definitions (16 achievements in `achievements.js`)
- ✅ Achievement auto-check on XP/currency changes
- ✅ Level-up announcements with milestone bonuses
- ✅ XP progress visualization (progress bars in embeds)

**Commands Implemented:**
- `/ping` - Latency check
- `/help` - Command list
- `/about` - Bot info
- `/serverinfo` - Server statistics
- `/userinfo` - User information
- `/stats` - User profile statistics
- `/balance` - Currency and XP balance
- `/daily` - Claim daily bonus
- `/rank` - Level and rank display
- `/profile` - Detailed user profile
- `/achievements` - View achievements

**Partially Implemented:**
- ⚠️ Dashboard (files exist but not tested/integrated)
- ⚠️ Premium currency award method (referenced but not implemented in currencyService)

**Not Yet Implemented:**
- ❌ Twitch integration (tmi.js)
- ❌ Shopify integration
- ❌ Leaderboards
- ❌ Shop system
- ❌ Inventory system
- ❌ Trading/gifting
- ❌ Daily topics
- ❌ Custom counters
- ❌ Voice chat tracking
- ❌ Social media feeds
- ❌ Survey system
- ❌ Gambling/betting
- ❌ Game launcher integration

# Active Work Areas

**Currently Being Developed:**
- Command migration from prefix (`!`) to slash commands (COMPLETE)
- Achievement system integration with chat tracker (COMPLETE)
- Level-up rewards and announcements (COMPLETE)

**Next Development Priorities (from architecture doc):**
1. Leaderboard system (Phase 2)
2. Shop system (Phase 3)
3. Trading/gifting (Phase 3)
4. Daily topics (Phase 4)

**Key Files Under Active Development:**
- `src/services/chatTracker.js` - Chat message handling and rewards
- `src/services/achievementService.js` - Achievement logic and auto-checking
- `src/events/levelUp.js` - Level-up announcements and unlocks
- `src/config/achievements.js` - Achievement definitions

# Testing Strategy

**Current Testing:**
- Manual testing in development Discord server
- No automated tests currently implemented

**Planned Testing:**
- Unit tests for service layer (currency calculations, XP formulas)
- Integration tests for database operations
- Command testing framework for slash commands

**Test Environment:**
- Use `GUILD_ID` env var for instant guild command updates during development
- Remove `GUILD_ID` for global command deployment (takes 1 hour to propagate)

**Command Deployment:**
- Run `npm run deploy` to register slash commands with Discord API
- Uses `src/deploy-commands.js` script
- Automatically loads all commands from `src/commands/` folders

# Deployment & Environments

**Environment Setup:**
1. Install Node.js v20+
2. Install PostgreSQL or use hosted instance (Railway.app)
3. Create Discord bot at https://discord.com/developers/applications
4. Copy `.env.example` to `.env` and fill in values
5. Run `node src/database/init.js` to initialize database schema
6. Run `npm run deploy` to register slash commands
7. Run `node index.js` to start bot

**Database Initialization:**
- `src/database/init.js` creates schema from `schema.sql`
- Seeds initial achievements
- Run once per database instance

**Configuration:**
- Bot prefix (legacy): `process.env.BOT_PREFIX` or `!`
- Currency settings in `src/config/config.js`
- Embed colors in `src/config/config.js`
- Achievement definitions in `src/config/achievements.js`

**Deployment Targets:**
- Development: Local machine with `GUILD_ID` set
- Production: Railway.app or Render.com with global commands

# Known Risks & Tradeoffs

**Technical Debt:**
- No caching layer (every request hits PostgreSQL)
- In-memory tracking (chat limits) resets on bot restart
- No automated tests
- Dashboard OAuth not tested
- Premium currency award method not implemented in currencyService

**Design Decisions:**
- Auto-registration: Users are created on first interaction (no explicit signup)
- Shared services: All services are singletons (not instantiated per-request)
- Rate limiting: In-memory tracking means limits reset on bot restart (acceptable tradeoff)
- Achievement definitions: Hardcoded in `achievements.js` (not dynamic/admin-editable)

**Scaling Limitations:**
- Single-server bot (not multi-guild)
- In-memory tracking doesn't scale across multiple bot instances
- No database connection pooling configuration (uses pg defaults)

**Security Considerations:**
- Admin check relies on single `ADMIN_USER_ID` (no role-based permissions)
- No audit logging for admin actions
- Dashboard authentication not implemented/tested

**Future Migration Concerns:**
- TypeScript migration mentioned in architecture but not implemented
- Twitch integration architecture not finalized
- Game launcher integration requires custom OAuth flow