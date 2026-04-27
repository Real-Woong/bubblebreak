ALTER TABLE rooms ADD COLUMN updated_at TEXT;
ALTER TABLE rooms ADD COLUMN finished_at TEXT;

UPDATE rooms
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS room_events (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  interest_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  responded_at TEXT,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (source_user_id) REFERENCES users(id),
  FOREIGN KEY (target_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_room_events_room_id
ON room_events(room_id);

CREATE INDEX IF NOT EXISTS idx_room_events_target_user_id
ON room_events(target_user_id);

CREATE INDEX IF NOT EXISTS idx_room_events_room_target
ON room_events(room_id, target_user_id);

CREATE INDEX IF NOT EXISTS idx_room_events_room_interest
ON room_events(room_id, interest_id);

CREATE TABLE IF NOT EXISTS room_sessions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (participant_id) REFERENCES room_participants(id)
);

CREATE INDEX IF NOT EXISTS idx_room_sessions_room_id
ON room_sessions(room_id);

CREATE INDEX IF NOT EXISTS idx_room_sessions_user_id
ON room_sessions(user_id);
