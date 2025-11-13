-- USERS TABLE (Core user data)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  discord_id VARCHAR(20) UNIQUE,
  twitch_id VARCHAR(20) UNIQUE,
  username VARCHAR(50) NOT NULL,
  currency INTEGER DEFAULT 0,
  premium_currency INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- USER PROFILES (Customization data)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100),
  color VARCHAR(7),
  badge VARCHAR(50),
  bio TEXT,
  streak_days INTEGER DEFAULT 0,
  last_active TIMESTAMP,
  customization_json JSONB
);

-- ACHIEVEMENTS (Predefined achievements)
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(50),
  reward_currency INTEGER DEFAULT 0,
  reward_premium_currency INTEGER DEFAULT 0,
  reward_xp INTEGER DEFAULT 0,
  icon_url VARCHAR(255),
  rarity VARCHAR(20) DEFAULT 'common',
  hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- USER ACHIEVEMENTS (User progress on achievements)
CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  required INTEGER DEFAULT 1,
  completed_at TIMESTAMP,
  UNIQUE(user_id, achievement_id)
);

-- TRANSACTIONS (All currency movements)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  category VARCHAR(50),
  amount INTEGER NOT NULL,
  currency_type VARCHAR(20) DEFAULT 'regular',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LEADERBOARD CACHE (Precomputed rankings)
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  value BIGINT NOT NULL,
  rank INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, user_id)
);

-- CUSTOM COUNTERS (Admin-created counters)
CREATE TABLE IF NOT EXISTS custom_counters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  value INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  platform VARCHAR(20) DEFAULT 'discord',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_discord ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_users_twitch ON users(twitch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_category ON leaderboard_cache(category, rank);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
