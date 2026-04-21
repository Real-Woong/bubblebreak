import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { validateInterests, type Interest } from "../lib/interests";

// POST /rooms 요청 body 타입
// 방 생성 시 닉네임과 setup에서 입력한 관심사 배열을 받는다.
type CreateRoomBody = {
  nickname?: string;
  interests?: Interest[];
};

// UUID 생성 함수
// userId, roomId, participantId처럼 고유 식별자가 필요한 곳에서 재사용한다.
function generateId() {
  return crypto.randomUUID();
}

// 방 코드 생성 함수
// 사용자가 직접 입력할 코드이므로 헷갈리기 쉬운 문자(0/O, 1/I)는 제외했다.
function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * chars.length);
    result += chars[index];
  }

  return result;
}

// 방 생성 API
// host user 생성 + room 생성 + host participant 생성까지 한 번에 처리한다.
export async function createRoomRoute(request: Request, env: Env) {
  try {
    // --------------------------------------------------
    // 1. 요청 body 파싱
    // --------------------------------------------------
    // 프론트에서 보낸 JSON을 읽고 필요한 값들을 꺼낸다.
    const body = (await request.json()) as CreateRoomBody;
    const nickname = body.nickname?.trim();
    // interests는 create / join 공통 규칙으로 검증한다.
    const interestsResult = validateInterests(body.interests);

    // --------------------------------------------------
    // 2. 입력값 검증
    // --------------------------------------------------
    // nickname이 없으면 user를 만들 수 없으므로 바로 실패 처리
    if (!nickname) {
      return jsonResponse(
        {
          ok: false,
          message: "nickname is required",
        },
        400
      );
    }

    // interests 배열이 기획 규칙을 어기면 방 생성 자체를 막는다.
    if (interestsResult.ok === false) {
      return jsonResponse(
        {
          ok: false,
          message: interestsResult.message,
        },
        400
      );
    }

    // --------------------------------------------------
    // 3. 필요한 ID 및 공통 값 생성
    // --------------------------------------------------
    const userId = generateId();        // users 테이블 PK
    const roomId = generateId();        // rooms 테이블 PK
    const participantId = generateId(); // room_participants 테이블 PK
    const roomCode = generateRoomCode(); // 유저들이 공유할 방 코드
    const now = new Date().toISOString(); // 생성 시각 통일
    // interests_json 컬럼은 TEXT 타입이라 문자열로 직렬화해서 넣는다.
    const interestsJson = JSON.stringify(interestsResult.interests);

    // --------------------------------------------------
    // 4. users 테이블에 host 생성
    // --------------------------------------------------
    // rooms.host_user_id가 users.id를 참조하므로
    // 반드시 room보다 먼저 user를 insert 해야 한다.
    const insertUser = await env.DB.prepare(
      `
      INSERT INTO users (id, nickname, created_at)
      VALUES (?, ?, ?)
      `
    )
      .bind(userId, nickname, now)
      .run();

    // user 생성 실패 시 다음 단계로 가면 참조 무결성이 깨질 수 있으므로 즉시 종료
    if (!insertUser.success) {
      return jsonResponse(
        {
          ok: false,
          message: "failed to create user",
        },
        500
      );
    }

    // --------------------------------------------------
    // 5. rooms 테이블에 방 생성
    // --------------------------------------------------
    // host_user_id에는 방금 만든 host userId를 넣는다.
    // 초기 상태는 waiting으로 시작한다.
    const insertRoom = await env.DB.prepare(
      `
      INSERT INTO rooms (id, code, host_user_id, status, created_at)
      VALUES (?, ?, ?, ?, ?)
      `
    )
      .bind(roomId, roomCode, userId, "waiting", now)
      .run();

    // room 생성 실패 시 host만 남는 상태가 되므로 즉시 종료
    if (!insertRoom.success) {
      return jsonResponse(
        {
          ok: false,
          message: "failed to create room",
        },
        500
      );
    }

    // --------------------------------------------------
    // 6. host도 participant로 추가
    // --------------------------------------------------
    // BubbleBreak 설계상 host도 participant로 저장해야
    // 로비 목록, ready 상태, 관심사 조회를 같은 구조로 다룰 수 있다.
    const insertParticipant = await env.DB.prepare(
      `
      INSERT INTO room_participants (id, room_id, user_id, joined_at, status, interests_json, is_ready)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(participantId, roomId, userId, now, "joined", interestsJson, 0)
      .run();

    // participant 생성 실패 시 host가 방에는 있지만 참가자 목록에는 없는 상태가 되므로 실패 처리
    if (!insertParticipant.success) {
      return jsonResponse(
        {
          ok: false,
          message: "failed to add host as participant",
        },
        500
      );
    }

    // --------------------------------------------------
    // 7. 최종 응답 반환
    // --------------------------------------------------
    // 프론트는 roomCode로 다음 화면에 진입하고,
    // userId는 이후 ready/start 같은 요청에서 자기 식별값으로 사용한다.
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
    // request.json() 파싱 실패 등 예상치 못한 입력 예외를 여기서 처리한다.
    return jsonResponse(
      {
        ok: false,
        message: "invalid request",
      },
      400
    );
  }
}
