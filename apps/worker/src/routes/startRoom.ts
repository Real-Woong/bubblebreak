import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";

// POST /rooms/:code/start body 타입
// 누가 시작 버튼을 눌렀는지 알아야 host 권한 체크가 가능하다.
type StartBody = {
  userId?: string;
};

// rooms 테이블에서 start 전 검증에 필요한 최소 컬럼만 조회
type RoomRow = {
  id: string;
  host_user_id: string;
  status: string;
};

// COUNT(*) 조회 결과 타입
type CountRow = {
  count: number;
};

// 게임 시작 API
// host 권한과 모든 participant 준비 여부를 확인한 뒤 rooms.status를 started로 바꾼다.
export async function startRoomRoute(request: Request, env: Env): Promise<Response> {
  try {
    // --------------------------------------------------
    // 1. URL에서 roomCode 추출
    // --------------------------------------------------
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/start$/);

    // 예상한 경로 형식이 아니면 에러
    if (!match) {
      return jsonResponse({ ok: false, message: "Invalid path" }, 400);
    }

    // --------------------------------------------------
    // 2. body 파싱
    // --------------------------------------------------
    const roomCode = match[1];
    const body = (await request.json()) as StartBody;
    const userId = body.userId?.trim();

    // 시작 요청을 누른 사용자가 누구인지 알아야 host 검증이 가능하다.
    if (!userId) {
      return jsonResponse({ ok: false, message: "userId is required" }, 400);
    }

    // --------------------------------------------------
    // 3. room 조회
    // --------------------------------------------------
    // host 여부와 현재 room 상태를 확인하기 위해 방 정보를 읽는다.
    const room = await env.DB.prepare(
      `
      SELECT id, host_user_id, status
      FROM rooms
      WHERE code = ?
      `
    )
      .bind(roomCode)
      .first<RoomRow>();

    // 존재하지 않는 roomCode면 시작 불가
    if (!room) {
      return jsonResponse({ ok: false, message: "Room not found" }, 404);
    }

    // --------------------------------------------------
    // 4. host 권한 확인
    // --------------------------------------------------
    // host만 게임 시작 버튼의 실제 권한을 가진다.
    // 프론트에서 버튼을 숨기더라도 백엔드에서 다시 검증해야 한다.
    if (room.host_user_id !== userId) {
      return jsonResponse({ ok: false, message: "Only host can start the room" }, 403);
    }

    // --------------------------------------------------
    // 5. room 상태 확인
    // --------------------------------------------------
    // waiting 상태가 아니면 이미 시작되었거나,
    // 현재 로직에서 허용하지 않는 상태라고 본다.
    if (room.status !== "waiting") {
      return jsonResponse({ ok: false, message: "Room is not in waiting state" }, 409);
    }

    // --------------------------------------------------
    // 6. non-host participant 준비 여부 확인
    // --------------------------------------------------
    // host를 제외한 joined 참가자 중 ready가 아닌 인원이 남아있는지 COUNT로 계산한다.
    const pendingParticipants = await env.DB.prepare(
      `
      SELECT COUNT(*) as count
      FROM room_participants
      WHERE room_id = ?
        AND status = 'joined'
        AND user_id != ?
        AND is_ready != 1
      `
    )
      .bind(room.id, userId)
      .first<CountRow>();

    // 결과가 없더라도 0으로 안전하게 처리
    const pendingCount = Number(pendingParticipants?.count ?? 0);

    // 준비 안 된 non-host가 1명이라도 남아 있으면 시작 불가
    if (pendingCount > 0) {
      return jsonResponse(
        { ok: false, message: "All non-host participants must be ready" },
        409
      );
    }

    // --------------------------------------------------
    // 7. room 상태를 started로 업데이트
    // --------------------------------------------------
    // 모든 조건을 통과했을 때만 실제 시작 상태로 바꾼다.
    const result = await env.DB.prepare(
      `
      UPDATE rooms
      SET status = 'started'
      WHERE id = ?
      `
    )
      .bind(room.id)
      .run();

    // update 실패 시 상태 전환이 보장되지 않으므로 500 반환
    if (!result.success) {
      return jsonResponse({ ok: false, message: "Failed to start room" }, 500);
    }

    // --------------------------------------------------
    // 8. 성공 응답
    // --------------------------------------------------
    return jsonResponse({
      ok: true,
      roomCode,
      status: "started",
    });
  } catch (error) {
    // body 파싱 실패 등 예상치 못한 예외 처리
    console.error(error);

    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
