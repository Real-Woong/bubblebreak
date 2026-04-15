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

-- interests_json:
-- setup 화면에서 입력한 deep1/deep2/deep3 관심사 배열을 JSON 문자열로 저장
-- host도 room_participants에 포함되므로 방 생성 시에도 함께 저장됨

-- 조회 가능용 인덱스
CREATE INDEX IF NOT EXISTS idx_rooms_code
ON rooms(code);

CREATE INDEX IF NOT EXISTS idx_room_participants_room_id
ON room_participants(room_id);

CREATE INDEX IF NOT EXISTS idx_room_participants_user_id
ON room_participants(user_id);