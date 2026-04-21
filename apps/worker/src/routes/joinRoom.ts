import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { validateInterests, type Interest } from "../lib/interests";

// POST /rooms/:code/join 요청 body 타입
// 참가 시에도 nickname과 interests를 함께 받는다.
type JoinRoomBody = {
  nickname?: string;
  interests?: Interest[];
};

// rooms 테이블에서 방 조회 시 사용하는 결과 타입
type RoomRow = {
  id: string;
  code: string;
  host_user_id: string;
  status: string;
  created_at: string;
};

// COUNT(*) 조회 결과 타입
// D1에서는 숫자가 문자열처럼 들어올 수 있어 실제 사용 전 Number(...) 처리한다.
type CountRow = {
  count: number;
};

// 방 참가 API
// 존재하는 roomCode에 대해 새 임시 사용자와 participant 세션을 생성한다.
export async function joinRoomRoute(request: Request, env: Env): Promise<Response> {
  try {
    // --------------------------------------------------
    // 1. method 체크
    // --------------------------------------------------
    // join 라우트는 POST만 허용한다.
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, message: "Method not allowed" }, 405);
    }

    // --------------------------------------------------
    // 2. URL에서 roomCode 추출
    // --------------------------------------------------
    // 예: /rooms/P3GL7Z/join
    // 여기서 P3GL7Z 부분이 roomCode이다.
    const url = new URL(request.url);

    const match = url.pathname.match(/^\/rooms\/([^/]+)\/join$/);

    // 경로가 예상한 형식과 다르면 잘못된 요청으로 본다.
    if (!match) {
      return jsonResponse({ ok: false, message: "Invalid path" }, 400);
    }

    const roomCode = match[1];

    // --------------------------------------------------
    // 3. body 파싱
    // --------------------------------------------------
    const body = (await request.json()) as JoinRoomBody;
    const nickname = body.nickname?.trim();
    // create와 완전히 같은 규칙으로 interests를 재검증한다.
    // 프론트에서 막았더라도 백엔드는 다시 확인해야 한다.
    const interestsResult = validateInterests(body.interests);

    // nickname이 비어 있으면 user 생성이 불가능하다.
    if (!nickname) {
      return jsonResponse({ ok: false, message: "Invalid nickname" }, 400);
    }

    // 관심사 형식이 잘못되면 참가를 막는다.
    if (interestsResult.ok === false) {
      return jsonResponse({ ok: false, message: interestsResult.message }, 400);
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

    // roomCode에 해당하는 방이 없으면 참가할 수 없다.
    if (!room) {
      return jsonResponse({ ok: false, message: "Room not found" }, 404);
    }

    // --------------------------------------------------
    // 5. 방 상태 체크
    // --------------------------------------------------
    // 지금은 waiting 상태만 입장 가능하다.
    // 이미 started 된 방에는 새 참가자를 받지 않는다.
    if (room.status !== "waiting") {
      return jsonResponse({ ok: false, message: "Room is not joinable" }, 409);
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

    // 조회 결과가 없더라도 안전하게 0으로 처리한다.
    const count = Number(countResult?.count ?? 0);

    // 현재 기획 기준 최대 6명까지만 허용
    if (count >= 6) {
      return jsonResponse({ ok: false, message: "Room is full" }, 409);
    }

    // --------------------------------------------------
    // 7. user 생성
    // --------------------------------------------------
    // 현재는 로그인 없는 임시 사용자이므로 join 시에도 새 user를 생성한다.
    const userId = crypto.randomUUID();
    const participantId = crypto.randomUUID();
    const now = new Date().toISOString();
    // room_participants.interests_json 컬럼에 저장할 문자열로 직렬화한다.
    const interestsJson = JSON.stringify(interestsResult.interests);

    // users 테이블에 새 임시 사용자 생성
    const insertUser = await env.DB.prepare(
      `
      INSERT INTO users (id, nickname, created_at)
      VALUES (?, ?, ?)
      `
    )
      .bind(userId, nickname, now)
      .run();

    // user 생성 실패 시 participant insert로 넘어가지 않는다.
    if (!insertUser.success) {
      return jsonResponse({ ok: false, message: "Failed to create user" }, 500);
    }

    // --------------------------------------------------
    // 8. participant 추가
    // --------------------------------------------------
    // 관심사와 ready 상태는 users가 아니라 room_participants에 저장한다.
    // 즉, 같은 사람도 방마다 다른 관심사/ready 상태를 가질 수 있다.
    const insertParticipant = await env.DB.prepare(
      `
      INSERT INTO room_participants (id, room_id, user_id, joined_at, status, interests_json, is_ready)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(participantId, room.id, userId, now, "joined", interestsJson, 0)
      .run();

    // participant 생성 실패 시 참가 완료로 볼 수 없으므로 에러 처리
    if (!insertParticipant.success) {
      return jsonResponse({ ok: false, message: "Failed to join room" }, 500);
    }

    // --------------------------------------------------
    // 9. 성공 응답
    // --------------------------------------------------
    return jsonResponse({
      ok: true,
      roomId: room.id,
      roomCode: room.code,
      userId,
      nickname,
    });
  } catch (err) {
    // 예상하지 못한 런타임 에러는 서버 로그에 남기고 500을 반환한다.
    console.error(err);

    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
