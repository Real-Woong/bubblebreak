// DB 실행 결과 타입
// D1에서 INSERT/UPDATE 실행 시 success 여부만 확인할 수 있음
type DbRunResult = {
  success: boolean;
};

// D1 statement 최소 타입 정의
// bind()로 파라미터 넣고 run()으로 실행
type DbStatement = {
  bind(...values: unknown[]): DbStatement;
  run(): Promise<DbRunResult>;
  first<T>(): Promise<T | null>;
};

// DB 객체 타입 (env.DB)
type DbLike = {
  prepare(query: string): DbStatement;
};

// Cloudflare Worker 환경 변수 타입
// wrangler.jsonc에서 바인딩한 DB를 여기서 사용
type Env = {
  DB: DbLike;
};

// DB에서 rooms 조회 결과 타입
type RoomRow = {
  id: string;
  code: string;
  host_user_id: string;
  status: string;
  created_at: string;
};

// COUNT 결과 타입
type CountRow = {
  count: number;
};

// JSON 응답 helper
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// 핵심 함수
export async function joinRoomRoute(request: Request, env: Env): Promise<Response> {
  try {
    // --------------------------------------------------
    // 1. method 체크
    // --------------------------------------------------
    // join은 POST만 허용
    if (request.method !== "POST") {
      return json({ ok: false, message: "Method not allowed" }, 405);
    }

    // --------------------------------------------------
    // 2. URL에서 roomCode 추출
    // --------------------------------------------------
    // 예: /rooms/P3GL7Z/join
    const url = new URL(request.url);

    const match = url.pathname.match(/^\/rooms\/([^/]+)\/join$/);

    // 경로가 우리가 기대한 형식이 아니면 에러
    if (!match) {
      return json({ ok: false, message: "Invalid path" }, 400);
    }

    const roomCode = match[1];

    // --------------------------------------------------
    // 3. body 파싱
    // --------------------------------------------------
    const body = await request.json();
    const nickname = body.nickname;

    if (!nickname || typeof nickname !== "string") {
      return json({ ok: false, message: "Invalid nickname" }, 400);
    }

    // --------------------------------------------------
    // 4. 방 조회 (roomCode 기준)
    // --------------------------------------------------
    const room = await env.DB.prepare(
      `
      SELECT id, code, host_user_id, status, created_at
      FROM rooms
      WHERE code = ?
      `
    )
      .bind(roomCode)
      .first<RoomRow>();

    // 방이 없으면 404
    if (!room) {
      return json({ ok: false, message: "Room not found" }, 404);
    }

    // --------------------------------------------------
    // 5. 방 상태 체크
    // --------------------------------------------------
    // 지금은 waiting 상태만 입장 가능
    if (room.status !== "waiting") {
      return json({ ok: false, message: "Room is not joinable" }, 409);
    }

    // --------------------------------------------------
    // 6. 현재 인원 수 체크 (최대 6명)
    // --------------------------------------------------
    const countResult = await env.DB.prepare(
      `
      SELECT COUNT(*) as count
      FROM room_participants
      WHERE room_id = ? AND status = 'joined'
      `
    )
      .bind(room.id)
      .first<CountRow>();

    const count = Number(countResult?.count ?? 0);

    if (count >= 6) {
      return json({ ok: false, message: "Room is full" }, 409);
    }

    // --------------------------------------------------
    // 7. user 생성
    // --------------------------------------------------
    const userId = crypto.randomUUID();
    const participantId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `
      INSERT INTO users (id, nickname, created_at)
      VALUES (?, ?, ?)
      `
    )
      .bind(userId, nickname, now)
      .run();

    // --------------------------------------------------
    // 8. participant 추가
    // --------------------------------------------------
    await env.DB.prepare(
      `
      INSERT INTO room_participants (id, room_id, user_id, joined_at, status)
      VALUES (?, ?, ?, ?, ?)
      `
    )
      .bind(participantId, room.id, userId, now, "joined")
      .run();

    // --------------------------------------------------
    // 9. 성공 응답
    // --------------------------------------------------
    return json({
      ok: true,
      roomId: room.id,
      roomCode: room.code,
      userId,
      nickname,
    });
  } catch (err) {
    console.error(err);

    return json({ ok: false, message: "Internal error" }, 500);
  }
}