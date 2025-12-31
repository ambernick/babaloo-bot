-- Shop Items (Redeemable rewards like channel points)
CREATE TABLE IF NOT EXISTS shop_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL,
  currency_type VARCHAR(20) DEFAULT 'regular', -- 'regular' or 'premium'
  category VARCHAR(50) DEFAULT 'other', -- 'cosmetic', 'physical', 'action', 'other'
  icon_url VARCHAR(255),
  stock INTEGER DEFAULT -1, -- -1 = unlimited, 0+ = limited stock
  enabled BOOLEAN DEFAULT TRUE,
  cooldown_minutes INTEGER DEFAULT 0, -- Per-user cooldown
  global_cooldown_minutes INTEGER DEFAULT 0, -- Global cooldown for all users
  requires_input BOOLEAN DEFAULT FALSE, -- Does redemption need user input?
  input_prompt TEXT, -- What to ask for (e.g., "Enter your Discord username")
  auto_fulfill BOOLEAN DEFAULT FALSE, -- Auto-mark as fulfilled or requires manual review
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Redemptions (Purchase history)
CREATE TABLE IF NOT EXISTS redemptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  shop_item_id INTEGER REFERENCES shop_items(id) ON DELETE SET NULL,
  cost INTEGER NOT NULL,
  currency_type VARCHAR(20) DEFAULT 'regular',
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'fulfilled', 'refunded', 'cancelled'
  user_input TEXT, -- User's input if requires_input was true
  fulfilled_by INTEGER REFERENCES users(id), -- Admin who fulfilled it
  fulfilled_at TIMESTAMP,
  notes TEXT, -- Admin notes
  refunded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Cooldowns (Track per-user item cooldowns)
CREATE TABLE IF NOT EXISTS user_item_cooldowns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  shop_item_id INTEGER REFERENCES shop_items(id) ON DELETE CASCADE,
  can_redeem_at TIMESTAMP NOT NULL,
  UNIQUE(user_id, shop_item_id)
);

-- Global Item Cooldowns (Track global item cooldowns)
CREATE TABLE IF NOT EXISTS global_item_cooldowns (
  shop_item_id INTEGER PRIMARY KEY REFERENCES shop_items(id) ON DELETE CASCADE,
  can_redeem_at TIMESTAMP NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON redemptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON redemptions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_items_enabled ON shop_items(enabled, category);
CREATE INDEX IF NOT EXISTS idx_user_cooldowns ON user_item_cooldowns(user_id, shop_item_id);

-- Trigger to update updated_at on shop_items
CREATE TRIGGER update_shop_items_updated_at
  BEFORE UPDATE ON shop_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();