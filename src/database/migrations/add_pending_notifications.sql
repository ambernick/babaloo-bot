-- Add pending achievement notifications table
CREATE TABLE IF NOT EXISTS pending_achievement_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_pending_achievements_user ON pending_achievement_notifications(user_id);
