-- users: 방 생성자/참가자 식별용
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- rooms: 방 정보 저장
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (host_user_id) REFERENCES users(id)
);

-- room_participants: 어떤 유저가 어떤 방에 들어왔는지 저장
CREATE TABLE room_participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(room_id, user_id)
);