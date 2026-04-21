import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";

// room 존재 여부 확인용 최소 타입
type RoomRow = {
  id: string;
};

// room_participants에서 ready 상태를 읽어올 때 사용하는 타입
type ParticipantRow = {
  user_id: string;
  is_ready: number;
};

// POST /rooms/:code/ready body 타입
type ReadyBody = {
  userId?: string;
};

// 준비 완료 API
// participant가 로비에서 "준비 완료" 버튼을 눌렀을 때 is_ready를 1로 바꾼다.
export async function readyRoomRoute(request: Request, env: Env): Promise<Response> {
  try {
    // --------------------------------------------------
    // 1. URL에서 roomCode 추출
    // --------------------------------------------------
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/ready$/);

    // 경로 형식이 다르면 잘못된 요청
    if (!match) {
      return jsonResponse({ ok: false, message: "Invalid path" }, 400);
    }

    // --------------------------------------------------
    // 2. body 파싱
    // --------------------------------------------------
    const roomCode = match[1];
    const body = (await request.json()) as ReadyBody;
    const userId = body.userId?.trim();

    // 준비 완료를 누른 참가자 식별용 userId는 필수다.
    if (!userId) {
      return jsonResponse({ ok: false, message: "userId is required" }, 400);
    }

    // --------------------------------------------------
    // 3. room 존재 여부 확인
    // --------------------------------------------------
    // roomCode가 잘못되면 해당 방에서 ready 처리할 수 없다.
    const room = await env.DB.prepare(
      `
      SELECT id
      FROM rooms
      WHERE code = ?
      `
    )
      .bind(roomCode)
      .first<RoomRow>();

    // roomCode에 해당하는 방이 없으면 종료
    if (!room) {
      return jsonResponse({ ok: false, message: "Room not found" }, 404);
    }

    // --------------------------------------------------
    // 4. 참가자 존재 여부 확인
    // --------------------------------------------------
    // 해당 room 안에 실제로 joined 상태로 들어와 있는 user인지 확인한다.
    const participant = await env.DB.prepare(
      `
      SELECT user_id, is_ready
      FROM room_participants
      WHERE room_id = ? AND user_id = ? AND status = 'joined'
      `
    )
      .bind(room.id, userId)
      .first<ParticipantRow>();

    // 이 방의 참가자가 아니면 ready 처리할 수 없다.
    if (!participant) {
      return jsonResponse({ ok: false, message: "Participant not found" }, 404);
    }

    // --------------------------------------------------
    // 5. 이미 ready인지 확인
    // --------------------------------------------------
    // 이미 ready 상태면 같은 결과를 그대로 반환해서
    // 같은 요청이 여러 번 와도 안전하게 처리한다.
    if (participant.is_ready === 1) {
      return jsonResponse({
        ok: true,
        roomCode,
        userId,
        isReady: 1,
      });
    }

    // --------------------------------------------------
    // 6. ready 상태 업데이트
    // --------------------------------------------------
    // 지금 단계에서는 토글이 아니라 단순히 0 -> 1로만 올린다.
    const result = await env.DB.prepare(
      `
      UPDATE room_participants
      SET is_ready = 1
      WHERE room_id = ? AND user_id = ?
      `
    )
      .bind(room.id, userId)
      .run();

    // update 실패 시 500 반환
    if (!result.success) {
      return jsonResponse({ ok: false, message: "Failed to update ready state" }, 500);
    }

    // --------------------------------------------------
    // 7. 성공 응답
    // --------------------------------------------------
    return jsonResponse({
      ok: true,
      roomCode,
      userId,
      isReady: 1,
    });
  } catch (error) {
    // request.json() 실패 등 예상치 못한 예외 처리
    console.error(error);

    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
