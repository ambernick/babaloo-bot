-- Command Settings table for controlling which channels commands can be used in
CREATE TABLE IF NOT EXISTS command_settings (
  id SERIAL PRIMARY KEY,
  command_name VARCHAR(100) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT TRUE,
  allowed_channel_ids TEXT[], -- Array of Discord channel IDs where command is allowed
  use_whitelist BOOLEAN DEFAULT FALSE, -- If true, only allowed_channel_ids can use. If false, all except blocked
  blocked_channel_ids TEXT[], -- Array of Discord channel IDs where command is blocked
  admin_only BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update updated_at
CREATE TRIGGER update_command_settings_updated_at
  BEFORE UPDATE ON command_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create index
CREATE INDEX IF NOT EXISTS idx_command_settings_name ON command_settings(command_name);