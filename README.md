# Babaloo Bot

Multi-platform engagement bot for the falsettovibrato community connecting Discord, Twitch, and custom games.

## Features (Current - MVP Phase 1)

- 🤖 Discord bot with professional command handler
- 💬 6 utility commands (ping, help, about, serverinfo, userinfo, stats)
- 🗄️ PostgreSQL database with complete schema
- 👥 Automatic user registration
- 📊 User statistics tracking
- 🏆 Achievement system (schema ready, implementation in progress)

## Tech Stack

- Node.js v20+
- Discord.js v14
- PostgreSQL
- Railway.app (database hosting)

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL (or Railway.app account)
- Discord Bot Token

### Installation
```bash
# Clone repository
git clone https://github.com/ambernick/babaloo-bot.git
cd babaloo-bot

# Install dependencies
npm install

# Set up environment variables
# Create .env file with:
DISCORD_TOKEN=your_discord_bot_token
DATABASE_URL=your_postgresql_connection_string

# Initialize database
node src/database/init.js

# Start bot
node index.js
```

## Commands

### Utility
- `!ping` - Check bot latency
- `!help` - Show all commands
- `!about` - Bot information
- `!serverinfo` - Server statistics
- `!userinfo [@user]` - User information
- `!stats` - Your profile statistics

## Roadmap

### Phase 1: Foundation (Current)
- [x] Bot infrastructure
- [x] Command handler
- [x] Database setup
- [x] User service
- [ ] Currency earning system
- [ ] XP and leveling

### Phase 2: Gamification (Weeks 2-3)
- [ ] Achievement system
- [ ] Leaderboards
- [ ] Daily bonuses
- [ ] Profile customization

### Phase 3: Economy (Weeks 4-6)
- [ ] Shop system
- [ ] Item inventory
- [ ] Trading
- [ ] Premium currency

## Project Structure
```
babaloo-bot/
├── src/
│   ├── commands/       # Bot commands
│   ├── events/         # Event handlers
│   ├── services/       # Business logic
│   ├── database/       # Database connection & schema
│   ├── utils/          # Utilities
│   └── config/         # Configuration
├── index.js            # Entry point
└── package.json
```

## Development

Built with automation in mind - all business logic is in services for easy dashboard integration later.

## License

MIT

## Author

falsettovibrato - [GitHub](https://github.com/ambernick) | [Twitch](https://twitch.tv/falsettovibrato)