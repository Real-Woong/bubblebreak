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

// 요청 body 타입
// 프론트에서 nickname 하나만 받는다 (MVP 기준)
type CreateRoomBody = {
  nickname?: string;
};

// JSON 응답 헬퍼 함수
// 매번 new Response 쓰기 귀찮으니까 함수로 빼둠
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// UUID 생성 함수
// userId, roomId, participantId 전부 여기서 생성
function generateId() {
  return crypto.randomUUID();
}

// 방 코드 생성 함수 (예: AB12CD)
// 혼동 줄이려고 0/O, 1/I 같은 문자 제거
function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * chars.length);
    result += chars[index];
  }

  return result;
}

// 🔥 핵심: 방 생성 API
export async function createRoomRoute(request: Request, env: Env) {
  try {
    // 1. 요청 body 파싱
    // 프론트에서 nickname 받음
    const body = (await request.json()) as CreateRoomBody;
    const nickname = body.nickname?.trim();

    // 2. 입력값 검증
    // nickname 없으면 바로 400 에러 반환
    if (!nickname) {
      return jsonResponse(
        {
          ok: false,
          message: "nickname is required",
        },
        400
      );
    }

    // 3. 필요한 ID 및 값 생성
    const userId = generateId();           // users 테이블용 PK
    const roomId = generateId();           // rooms 테이블용 PK
    const participantId = generateId();    // room_participants PK
    const roomCode = generateRoomCode();   // 유저가 입력하는 방 코드
    const now = new Date().toISOString();  // 시간 통일 (ISO 형식)

    // 4. users 테이블에 방장 생성
    // rooms.host_user_id가 users를 참조하므로 반드시 먼저 insert
    const insertUser = await env.DB.prepare(
      `
      INSERT INTO users (id, nickname, created_at)
      VALUES (?, ?, ?)
      `
    )
      .bind(userId, nickname, now)
      .run();

    // 실패 시 바로 종료
    if (!insertUser.success) {
      return jsonResponse(
        {
          ok: false,
          message: "failed to create user",
        },
        500
      );
    }

    // 5. rooms 테이블에 방 생성
    // host_user_id는 위에서 만든 userId
    const insertRoom = await env.DB.prepare(
      `
      INSERT INTO rooms (id, code, host_user_id, status, created_at)
      VALUES (?, ?, ?, ?, ?)
      `
    )
      .bind(roomId, roomCode, userId, "waiting", now)
      .run();

    if (!insertRoom.success) {
      return jsonResponse(
        {
          ok: false,
          message: "failed to create room",
        },
        500
      );
    }

    // 6. 방장도 참가자 테이블에 추가
    // (이거 안 하면 방장은 참가자 목록에 안 보임)
    const insertParticipant = await env.DB.prepare(
      `
      INSERT INTO room_participants (id, room_id, user_id, joined_at, status)
      VALUES (?, ?, ?, ?, ?)
      `
    )
      .bind(participantId, roomId, userId, now, "joined")
      .run();

    if (!insertParticipant.success) {
      return jsonResponse(
        {
          ok: false,
          message: "failed to add host as participant",
        },
        500
      );
    }

    // 7. 최종 응답 반환
    // 프론트는 roomCode로 입장하고, userId로 유저 식별
    return jsonResponse(
      {
        ok: true,
        roomId,
        roomCode,
        userId,
        nickname,
      },
      201
    );

  } catch (error) {
    // JSON 파싱 실패 등 모든 예외 처리
    return jsonResponse(
      {
        ok: false,
        message: "invalid request",
      },
      400
    );
  }
}