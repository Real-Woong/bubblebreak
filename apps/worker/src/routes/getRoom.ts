import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";

// rooms 테이블에서 방 기본 정보를 읽어올 때 사용하는 타입
type RoomRow = {
  id: string;
  code: string;
  host_user_id: string;
  status: string;
};

// 프론트가 로비/버블필드에서 바로 쓰기 쉽게 alias를 맞춘 응답 행 타입
// SQL alias를 camelCase 쪽에 맞춰주면 FE에서 후처리가 줄어든다.
type ParticipantRow = {
  userId: string;
  nickname: string;
  status: string;
  isReady: number;
  interests_json: string;
};

// 방 조회 API
// 로비 화면과 BubbleField 화면이 공통으로 참고할 현재 room 상태를 반환한다.
export async function getRoomRoute(request: Request, env: Env): Promise<Response> {
  try {
    // --------------------------------------------------
    // 1. URL에서 roomCode 추출
    // --------------------------------------------------
    // /rooms/:code 형태의 경로에서 코드 부분만 뽑아낸다.
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)$/);

    // 경로 형식이 다르면 잘못된 요청
    if (!match) {
      return jsonResponse({ ok: false, message: "Invalid path" }, 400);
    }

    const roomCode = match[1];

    // --------------------------------------------------
    // 2. 방 기본 정보 조회
    // --------------------------------------------------
    // 먼저 rooms 테이블에서 방이 존재하는지 확인한다.
    const room = await env.DB.prepare(
      `
      SELECT id, code, host_user_id, status
      FROM rooms
      WHERE code = ?
      `
    )
      .bind(roomCode)
      .first<RoomRow>();

    // 없는 방이면 participants 조회까지 갈 필요 없이 종료
    if (!room) {
      return jsonResponse({ ok: false, message: "Room not found" }, 404);
    }

    // --------------------------------------------------
    // 3. 참가자 목록 조회
    // --------------------------------------------------
    // participants는 room_participants에 있고,
    // nickname 원본은 users에 있으므로 JOIN으로 합쳐서 가져온다.
    const participantsResult = await env.DB.prepare(
      `
      SELECT
        room_participants.user_id as userId,
        users.nickname as nickname,
        room_participants.status as status,
        room_participants.is_ready as isReady,
        room_participants.interests_json as interests_json
      FROM room_participants
      INNER JOIN users ON users.id = room_participants.user_id
      WHERE room_participants.room_id = ?
      ORDER BY room_participants.joined_at ASC
      `
    )
      .bind(room.id)
      .all<ParticipantRow>();

    // --------------------------------------------------
    // 4. 최종 응답 반환
    // --------------------------------------------------
    // interests_json은 문자열 그대로 반환한다.
    // FE가 필요할 때 JSON.parse 해서 BubbleField 데이터로 변환하면 된다.
    return jsonResponse({
      ok: true,
      room: {
        code: room.code,
        status: room.status,
        hostUserId: room.host_user_id,
      },
      participants: participantsResult.results ?? [],
    });
  } catch (error) {
    // 예상하지 못한 예외는 서버 로그를 남기고 500으로 응답
    console.error(error);

    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
