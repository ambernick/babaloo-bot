-- Add bot_settings table for runtime configuration
CREATE TABLE IF NOT EXISTS bot_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO bot_settings (key, value, description, category) VALUES
  ('achievement_notification_channel_id', '', 'Channel ID where achievement notifications are sent (leave empty to send in chat channel)', 'notifications'),
  ('stream_notification_channel_id', '', 'Channel ID where stream live notifications are sent', 'notifications'),
  ('stream_notification_message', '@everyone 🔴 **{username} is now LIVE!**', 'Default message for stream notifications. Placeholders: {username}, {title}, {game}, {url}', 'notifications'),
  ('stream_notification_role_id', 'everyone', 'Role ID to mention for stream notifications (use "everyone" for @everyone)', 'notifications'),
  ('xp_per_message', '2', 'XP awarded per chat message', 'xp'),
  ('xp_rate_limit_seconds', '60', 'Minimum seconds between XP awards for the same user', 'xp'),
  ('currency_per_message', '1', 'Currency awarded per chat message', 'currency'),
  ('currency_rate_limit_seconds', '60', 'Minimum seconds between currency awards for the same user', 'currency'),
  ('currency_hourly_limit', '60', 'Maximum currency a user can earn per hour', 'limits'),
  ('daily_bonus_currency', '100', 'Currency awarded from /daily command', 'currency'),
  ('daily_bonus_xp', '50', 'XP awarded from /daily command', 'xp')
ON CONFLICT (key) DO NOTHING;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for bot_settings
DROP TRIGGER IF EXISTS update_bot_settings_updated_at ON bot_settings;
CREATE TRIGGER update_bot_settings_updated_at
  BEFORE UPDATE ON bot_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
