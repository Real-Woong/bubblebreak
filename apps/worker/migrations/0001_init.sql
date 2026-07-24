-- BubbleBreak D1 schema
-- Fresh Cloudflare D1 database용 최종 스키마입니다.

-- users: 로그인 없는 임시 사용자 식별용
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- rooms: 방 자체 정보 저장
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  finished_at TEXT,
  FOREIGN KEY (host_user_id) REFERENCES users(id)
);

-- room_participants: 이 방 세션에서의 참가자 상태/관심사 저장
CREATE TABLE IF NOT EXISTS room_participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  status TEXT NOT NULL,
  interests_json TEXT NOT NULL,
  is_ready INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(room_id, user_id)
);

-- room_events: 버블 pop, deep3 공개 요청/응답 이벤트 저장
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

-- room_sessions: cookie 기반 방 참여 세션 저장
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

-- 조회 가능용 인덱스
CREATE INDEX IF NOT EXISTS idx_rooms_code
ON rooms(code);

CREATE INDEX IF NOT EXISTS idx_room_participants_room_id
ON room_participants(room_id);

CREATE INDEX IF NOT EXISTS idx_room_participants_user_id
ON room_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_room_events_room_id
ON room_events(room_id);

CREATE INDEX IF NOT EXISTS idx_room_events_target_user_id
ON room_events(target_user_id);

CREATE INDEX IF NOT EXISTS idx_room_events_room_target
ON room_events(room_id, target_user_id);

CREATE INDEX IF NOT EXISTS idx_room_events_room_interest
ON room_events(room_id, interest_id);

CREATE INDEX IF NOT EXISTS idx_room_sessions_room_id
ON room_sessions(room_id);

CREATE INDEX IF NOT EXISTS idx_room_sessions_user_id
ON room_sessions(user_id);
