I'll create a separate `ARCHITECTURE.md` file since this is a comprehensive architectural vision that goes beyond the current Babaloo Bot implementation and describes the broader multi-platform gaming ecosystem.

# ARCHITECTURE.md

# Multi-Platform Gaming Ecosystem Architecture

This document describes the long-term architectural vision for the falsettovibrato gaming platform, which includes the Babaloo Bot as one component of a larger ecosystem.

## Core Principle

**Separate by responsibility, not by game.**

Do NOT build:
- One giant server
- One giant database  
- One giant codebase

DO build:
- Shared services for shared logic
- Isolated services for game-specific logic

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                              │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Desktop    │   Discord    │     Web      │    Mobile      │
│   Launcher   │  Activities  │    Games     │     Apps       │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       └──────────────┴──────────────┴────────────────┘
                      │
       ┌──────────────┴──────────────┐
       │                             │
┌──────▼──────────┐         ┌────────▼────────┐
│  Auth Service   │         │  Progress       │
│  (Shared)       │◄────────┤  Service        │
└─────────────────┘         │  (Shared)       │
                            └─────────────────┘
       │                             │
       └──────────────┬──────────────┘
                      │
       ┌──────────────┴──────────────┐
       │                             │
┌──────▼──────────┐         ┌────────▼────────┐
│   Bot Service   │         │  Game Services  │
│   (Discord,     │         │  (Per-Game)     │
│    Twitch)      │         │                 │
└─────────────────┘         └─────────────────┘
```

## 1. Core Platform Services (Shared)

### Auth & Account Service

**Responsibilities:**
- Unified user accounts across Discord, launcher, and web games
- OAuth login (Discord, Google, Twitch)
- User ID mapping and session management
- JWT token generation and validation

**Technology:**
- Node.js + Express
- PostgreSQL or Supabase
- JWT for stateless authentication
- OAuth2 libraries (passport, passport-discord)

**Database Schema:**
```sql
accounts (
  id, email, password_hash,
  discord_id, twitch_id, google_id,
  created_at, updated_at
)

sessions (
  id, account_id, token, expires_at
)

oauth_connections (
  account_id, provider, provider_id, 
  access_token, refresh_token
)
```

**Why Separate:**
- Every game and service needs authentication
- Changes to auth affect the entire ecosystem
- Security concerns require isolation
- Can be scaled independently

**Hosting:**
- Railway.app or Supabase (free tier → $5-10/month)
- Single instance sufficient for <100k users

### User Profile & Progress Service

**Responsibilities:**
- Cross-platform XP and leveling
- Global achievements and unlocks
- Progress tracking across all games
- Discord role/badge synchronization
- Event aggregation from all games

**Event-Driven Architecture:**
Games send events to this service rather than updating progress directly.

Example events:
```javascript
{
  userId: "123",
  game: "yugioh",
  event: "match_win",
  metadata: {
    opponent: "456",
    duration: 420,
    deck: "blue-eyes"
  }
}
```

**Technology:**
- Node.js + Express
- PostgreSQL (can share DB with Auth initially)
- Event queue (simple in-memory → Redis → RabbitMQ as needed)

**Database Schema:**
```sql
user_progress (
  account_id, total_xp, level,
  achievements_unlocked, last_active
)

game_progress (
  account_id, game_id, game_specific_data (JSONB)
)

achievement_events (
  id, account_id, game, event_type,
  metadata, timestamp
)
```

**Why Separate:**
- Centralizes all progression logic
- Games remain stateless for user progress
- Easier to implement cross-game achievements
- Can evolve progress formulas without touching games

**Hosting:**
- Combined with Auth Service initially (same Railway instance)
- Separate when event volume exceeds ~1000/minute

## 2. Bot & Social Integration Service

### Multi-Platform Bot Service

**Responsibilities:**
- Discord bot (Babaloo Bot - current implementation)
- Twitch bot integration
- YouTube/Instagram/Twitter feed automation
- Social media post announcements
- Community engagement features

**Why Separate:**
- High event volume (every Discord message)
- API rate limits require isolation
- Bot crashes shouldn't affect games
- Different scaling characteristics

**Technology:**
- Node.js
- discord.js (Discord API)
- tmi.js (Twitch API)
- Worker processes per platform
- PostgreSQL for bot-specific data (currency, daily bonuses)

**Current Implementation:**
This is the Babaloo Bot as documented in CLAUDE.md.

**Integration Points:**
```javascript
// Bot listens to progress events
progressService.on('levelUp', (userId, level) => {
  discordBot.announceLevel(userId, level);
});

// Bot sends events to progress service
chatTracker.onMessage(() => {
  progressService.recordEvent({
    userId, game: 'discord', event: 'message_sent'
  });
});
```

**Hosting:**
- Railway.app (good for always-on bots)
- Separate instance from game servers
- $5/month for small communities

## 3. Game Launcher

### Launcher Client (Desktop Application)

**Responsibilities:**
- User authentication (via Auth Service)
- Display available games
- Download and update games
- Launch game executables
- Sync Discord Rich Presence
- Show cross-game progress/achievements

**Technology:**
- Electron + React
- Auto-updater (electron-updater)
- Local storage for game installations
- WebSocket connection to Auth Service

**Communication Flow:**
```
Launcher → Auth Service (login)
Launcher → Launcher Backend (version check)
Launcher → CDN (download game files)
Launcher → Progress Service (show achievements)
Game → Auth Service (validate session)
Game → Game Backend (gameplay)
```

**Hosting:**
- Desktop application (no hosting)
- Update manifests on CDN or static hosting

### Launcher Backend (Lightweight API)

**Responsibilities:**
- Version checking and update manifests
- Game availability status
- CDN URLs for game downloads
- Patch notes and announcements

**Technology:**
- Node.js + Express
- Static JSON files or simple database
- CDN integration (Cloudflare, DigitalOcean Spaces)

**Endpoints:**
```
GET /api/launcher/version
GET /api/games/list
GET /api/games/:gameId/manifest
GET /api/games/:gameId/changelog
```

**Hosting:**
- Railway.app or shared VPS
- Minimal resources (<1GB RAM)
- Can be combined with Auth Service initially

## 4. Game Services (Per-Game Backends)

**Critical Design Decision: Each game gets its own backend.**

### Why Separate Game Backends?

1. **Different performance requirements** - Card games vs MMORPGs have vastly different needs
2. **Independent deployment** - Update one game without affecting others
3. **Fault isolation** - One game crashing doesn't take down the ecosystem
4. **Technology flexibility** - Use best tool per game (Node.js, Python, Go, Rust)
5. **Easier debugging** - Isolated logs and metrics per game
6. **Cost optimization** - Scale only what needs scaling

### Game Backend Types

#### A. Turn-Based Card Games
(Yu-Gi-Oh, Lorcana, Uno, Monopoly)

**Shared Engine Approach:**
Build one card game engine with pluggable rule modules.

```
card-game-engine/
├── core/
│   ├── matchmaking.js
│   ├── turn-system.js
│   ├── websocket-handler.js
│   └── game-state.js
├── rules/
│   ├── yugioh-rules.js
│   ├── lorcana-rules.js
│   └── uno-rules.js
└── api/
    └── game-server.js
```

**Technology:**
- Node.js (good for turn-based, I/O-bound)
- WebSockets (Socket.io or ws)
- Redis for matchmaking queues
- PostgreSQL for match history

**Hosting:**
- Single $5 VPS can handle multiple card games (different processes)
- Reverse proxy (nginx) routes by subdomain
- Example: yugioh.falsetto.com, lorcana.falsetto.com

**Scaling:**
- Horizontal: Add more game server instances
- Load balancer distributes matches
- Redis pub/sub for cross-server communication

#### B. Auto Chess

**Unique Requirements:**
- Tick-based simulation (game loop)
- More CPU-intensive than card games
- Potentially AI opponents
- Real-time combat resolution

**Technology:**
- Node.js or Go (better for CPU-bound loops)
- WebSockets for real-time updates
- Separate from card games (different performance profile)

**Hosting:**
- Dedicated $5-10 VPS
- DO NOT mix with card games (resource contention)

#### C. Pokémon MORPG

**Unique Requirements:**
- Persistent world state
- Player movement and collision
- Real-time position synchronization
- Potentially large player counts

**Technology:**
- Node.js with custom networking OR
- Colyseus (multiplayer game framework) OR
- Unity + Photon/Mirror (if using Unity)

**Hosting:**
- Dedicated $10-20 VPS (most resource-intensive)
- Consider Kubernetes for horizontal scaling later
- Database: PostgreSQL for player data, Redis for world state

### Game Backend Communication Pattern

```javascript
// Game sends progress events
gameServer.on('matchComplete', (match) => {
  progressService.recordEvent({
    userId: match.winnerId,
    game: 'yugioh',
    event: 'match_win',
    metadata: match.stats
  });
});

// Game validates auth
gameServer.on('connection', async (socket, token) => {
  const user = await authService.validateToken(token);
  if (!user) socket.disconnect();
});
```

## 5. Discord Activities

Discord Activities are **web clients** for specific games that run inside Discord.

**Architecture:**
```
Discord Activity (React SPA)
    ↓ (authenticate)
Auth Service
    ↓ (validate token)
Game Backend (WebSocket)
    ↓ (send events)
Progress Service
```

**Important Rules:**
- Activities should NOT contain game logic
- Activities are just UI + networking
- All logic lives in game backend
- Activities authenticate via Auth Service

**Example Flow:**
```javascript
// Activity code (runs in Discord iframe)
const token = await authService.login();
const ws = new WebSocket('wss://yugioh.falsetto.com');
ws.send({ type: 'auth', token });

ws.on('gameState', (state) => {
  renderGame(state); // Just UI update
});

ws.on('yourTurn', () => {
  // User makes move in UI
  ws.send({ type: 'playCard', cardId: 123 });
});
```

**Hosting:**
- Static hosting (Vercel, Netlify, Cloudflare Pages)
- Free tier sufficient
- Just HTML/CSS/JS bundles

## 6. Database Strategy

### ❌ Anti-Pattern: Single Database

DO NOT put everything in one database. This creates:
- Tight coupling
- Performance bottlenecks
- Difficult migrations
- Unclear ownership

### ✅ Database Separation Strategy

| Database           | Purpose                              | Schema Example                     |
| ------------------ | ------------------------------------ | ---------------------------------- |
| **Auth DB**        | Accounts, OAuth, sessions            | accounts, oauth_connections        |
| **Progress DB**    | XP, achievements, cross-game stats   | user_progress, achievements        |
| **Bot DB**         | Discord currency, daily bonuses      | users, transactions (Babaloo Bot)  |
| **YuGiOh DB**      | Decks, matches, card collections     | decks, matches, card_inventory     |
| **AutoChess DB**   | Unit compositions, match history     | compositions, autochess_matches    |
| **Pokemon DB**     | Pokemon owned, trainer progress      | pokemon, trainers, world_state     |

**Early Stage:**
- Auth + Progress can share a database instance (different schemas)
- Bot DB separate (already implemented in Babaloo Bot)
- Each game gets its own database as it's built

**Scaling:**
- Use PostgreSQL schemas for logical separation within one instance
- Migrate to separate instances when queries-per-second exceeds ~1000

**Example Connection Strategy:**
```javascript
// services/database/connections.js
const authDB = new Pool({ connectionString: process.env.AUTH_DB_URL });
const progressDB = new Pool({ connectionString: process.env.PROGRESS_DB_URL });
const yugiohDB = new Pool({ connectionString: process.env.YUGIOH_DB_URL });

module.exports = { authDB, progressDB, yugiohDB };
```

## 7. Hosting Layout & Cost Estimates

### Recommended Infrastructure (Small Scale)

| Service                   | Hosting Option     | Cost/Month | Notes                           |
| ------------------------- | ------------------ | ---------- | ------------------------------- |
| Auth + Progress Service   | Railway / Supabase | $5-10      | Combined initially              |
| Babaloo Bot (Discord)     | Railway            | $5         | Current implementation          |
| Card Games Backend        | DigitalOcean VPS   | $5         | Multiple games, one server      |
| Auto Chess Backend        | DigitalOcean VPS   | $5         | Dedicated server                |
| Pokémon MORPG Backend     | DigitalOcean VPS   | $10        | More resources needed           |
| Launcher Backend          | Railway            | Free-$5    | Low traffic                     |
| Static Assets (CDN)       | Cloudflare Pages   | Free       | Game downloads, activity builds |
| **Total (Early Stage)**   |                    | **$30-40** | Scales to thousands of users    |

### Growth Phase (10k+ users)

| Service                 | Hosting Option        | Cost/Month | Notes                     |
| ----------------------- | --------------------- | ---------- | ------------------------- |
| Auth Service            | Railway Pro           | $20        | Autoscaling               |
| Progress Service        | Railway Pro           | $20        | Separate from auth        |
| Bot Service             | Railway Pro           | $10        | Stable                    |
| Card Games (3 servers)  | DigitalOcean VPS      | $15        | Load balanced             |
| Auto Chess (2 servers)  | DigitalOcean VPS      | $10        | Horizontal scaling        |
| Pokémon MORPG           | DigitalOcean VPS      | $40        | 8GB RAM, dedicated        |
| Database (Managed)      | DigitalOcean Postgres | $15        | Automated backups         |
| **Total (Growth)**      |                       | **$130**   | Handles 10-50k users      |

## 8. Communication Flow Examples

### User Plays Game in Launcher

```
1. User opens Launcher
2. Launcher → Auth Service (validate session)
3. Auth Service → Launcher (user data + token)
4. User clicks "Play Yu-Gi-Oh"
5. Launcher → Launcher Backend (check version)
6. Launcher Backend → Launcher (latest version OK)
7. Launcher launches game executable
8. Game → Auth Service (validate token)
9. Auth Service → Game (user ID + profile)
10. Game → YuGiOh Backend (connect WebSocket)
11. User plays match
12. YuGiOh Backend → Progress Service (match_win event)
13. Progress Service → Bot Service (level up notification)
14. Bot Service → Discord (announce level up)
```

### User Plays Discord Activity

```
1. User opens Discord Activity
2. Activity → Auth Service (Discord OAuth)
3. Auth Service → Activity (JWT token)
4. Activity → YuGiOh Backend (connect WebSocket with token)
5. YuGiOh Backend → Auth Service (validate token)
6. Auth Service → YuGiOh Backend (user verified)
7. User plays match (same as launcher flow)
8. YuGiOh Backend → Progress Service (events)
9. Progress Service updates XP
10. (Optional) Progress Service → Bot (announce)
```

### Cross-Game Achievement

```
1. User completes match in YuGiOh
2. YuGiOh Backend → Progress Service ({ event: 'match_win', game: 'yugioh' })
3. User completes match in Auto Chess
4. AutoChess Backend → Progress Service ({ event: 'match_win', game: 'autochess' })
5. Progress Service checks: "Win in 3 different games"
6. Progress Service unlocks achievement
7. Progress Service → Auth Service (update user unlocks)
8. Progress Service → Bot Service (announce achievement)
9. Bot Service → Discord (embed with achievement)
```

## 9. Why This Architecture Works Long-Term

**Modularity:**
- Add new games without touching existing services
- Remove games without breaking ecosystem
- Iterate on one service independently

**Fault Isolation:**
- YuGiOh server crashes → other games unaffected
- Bot goes down → games keep running
- Auth service issues → games run in degraded mode with cached credentials

**Independent Scaling:**
- Scale only what needs scaling
- Card games stay small, MORPG scales up
- Progress service scales with total users, not per-game

**Technology Flexibility:**
- Use Node.js for turn-based games
- Use Go or Rust for CPU-intensive games
- Use Unity/Godot for client rendering
- Each service picks best tool

**Cost Efficiency:**
- Start with $30-40/month
- Scale services individually
- Avoid over-provisioning
- Free tiers for static hosting

**Developer Experience:**
- Clear boundaries = easier onboarding
- Isolated codebases = easier debugging
- Service contracts = clear interfaces
- Independent deployments = faster iterations

## 10. Migration Path from Current State

### Current State (Babaloo Bot)
- Discord bot with economy system
- Single codebase
- PostgreSQL database
- Hosted on single instance

### Phase 1: Extract Auth Service (Months 1-2)
1. Create new Auth Service repository
2. Move Discord OAuth to Auth Service
3. Implement JWT token generation
4. Update Babaloo Bot to validate tokens from Auth Service
5. Keep bot database separate (currency, XP)

### Phase 2: Build Progress Service (Months 3-4)
1. Create Progress Service repository
2. Define event schema
3. Implement achievement system in Progress Service
4. Migrate cross-platform achievements from Bot
5. Bot sends events to Progress Service

### Phase 3: First Game Backend (Months 5-8)
1. Choose simplest game (e.g., Uno or simple card game)
2. Build game backend with WebSocket server
3. Integrate with Auth Service
4. Send game events to Progress Service
5. Build simple web client

### Phase 4: Launcher MVP (Months 9-12)
1. Build Electron launcher shell
2. Implement login (Auth Service)
3. Show single game
4. Download and launch game executable
5. Display progress from Progress Service

### Phase 5: Discord Activity (Months 12-15)
1. Convert web client to Discord Activity format
2. Test in Discord Activity sandbox
3. Submit for Discord approval
4. Launch to community

### Phase 6: Additional Games (Ongoing)
Each new game follows pattern:
1. Build game backend
2. Integrate Auth + Progress services
3. Build client (web/desktop/activity)
4. Deploy to separate infrastructure

## 11. Critical Success Factors

**Start Small:**
- Build Auth Service first
- Build ONE simple game
- Prove the architecture works
- Add complexity incrementally

**Document Contracts:**
- API contracts between services (OpenAPI/Swagger)
- Event schemas (JSON Schema)
- Database schemas (migrations)
- Clear service boundaries

**Automate Early:**
- CI/CD for each service
- Automated testing
- Database migrations
- Deployment scripts

**Monitor Everything:**
- Service health checks
- Error logging (Sentry, LogRocket)
- Performance metrics
- User analytics

**Version Carefully:**
- API versioning (v1, v2)
- Database migration strategy
- Backward compatibility
- Deprecation policies

## 12. Anti-Patterns to Avoid

❌ **Monolith First, Then Split**
- Don't build everything in one codebase
- Splitting later is extremely painful
- Start with service boundaries from day one

❌ **Shared Database Across Services**
- Services should own their data
- No cross-service SQL joins
- Use APIs for cross-service data

❌ **Synchronous Service-to-Service Calls**
- Use events/queues for non-critical paths
- Avoid cascading failures
- Implement circuit breakers

❌ **No Service Contracts**
- Always define API contracts
- Version your APIs
- Don't break backward compatibility

❌ **Building Everything Before Launching**
- Ship incrementally
- Get user feedback early
- Iterate on one game at a time

## 13. Technology Recommendations

**When to Use What:**

| Technology    | Use Case                                          | Don't Use For                    |
| ------------- | ------------------------------------------------- | -------------------------------- |
| **Node.js**   | APIs, bots, turn-based games, I/O-heavy tasks     | CPU-intensive simulations        |
| **Go**        | High-performance game servers, concurrent systems | Rapid prototyping, web UIs       |
| **Rust**      | Ultra-low-latency games, system-level code        | Quick iterations, small projects |
| **Python**    | AI/ML, data processing, admin tools               | Real-time game servers           |
| **PostgreSQL**| Relational data, transactions, complex queries    | High-write throughput (>10k/sec) |
| **Redis**     | Caching, sessions, pub/sub, leaderboards          | Primary data store               |
| **MongoDB**   | Flexible schemas, document storage                | Relational data, ACID guarantees |

## 14. Final Recommendations

**For Babaloo Bot Today:**
- Continue development as documented in CLAUDE.md
- Keep bot as isolated service
- Prepare for Auth Service extraction
- Design with events in mind

**For First Game (Next 6 Months):**
- Build simplest card game (Uno or basic Yu-Gi-Oh)
- Implement Auth Service
- Prove the service architecture works
- Get community feedback

**For Launcher (12 Months):**
- Build after first game is stable
- Start with web version
- Desktop launcher can wait
- Focus on core experience

**For Multi-Game Platform (18-24 Months):**
- Add second game
- Implement Progress Service
- Build cross-game achievements
- Scale infrastructure as needed

**Remember:**
This is a **multi-year vision**. Build incrementally. Ship often. Get feedback. Iterate. The architecture described here allows you to start small and scale naturally without major rewrites.