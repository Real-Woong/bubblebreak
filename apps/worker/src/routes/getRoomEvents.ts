import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { getRoomByCode, loadAnonIdMap } from "../lib/rooms";
import { anonymizeEvents, isAnonymousPhase } from "../lib/anonymity";
import { getSessionContext, touchSession } from "../lib/session";
import type { ApiRoomEventRow } from "../lib/events";

export async function getRoomEventsRoute(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/events$/);

    if (!match) {
      return jsonResponse({ ok: false, message: "Invalid path" }, 400);
    }

    const roomCode = match[1];
    const room = await getRoomByCode(env, roomCode);
    const session = await getSessionContext(request, env);

    if (!room) {
      return jsonResponse({ ok: false, message: "Room not found" }, 404);
    }

    if (!session) {
      return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
    }

    if (session.roomId !== room.id) {
      return jsonResponse({ ok: false, message: "Session does not match room" }, 403);
    }

    const result = await env.DB.prepare(
      `
      SELECT
        id,
        event_type as eventType,
        source_user_id as sourceUserId,
        target_user_id as targetUserId,
        interest_id as interestId,
        status,
        created_at as createdAt,
        responded_at as respondedAt
      FROM room_events
      WHERE room_id = ?
        AND (source_user_id = ? OR target_user_id = ?)
      ORDER BY created_at DESC
      LIMIT 50
      `
    )
      .bind(room.id, session.userId, session.userId)
      .all<ApiRoomEventRow>();

    await touchSession(env, session.sessionId, new Date().toISOString());

    const events = result.results ?? [];
    const anonIds = isAnonymousPhase(room.status) ? await loadAnonIdMap(env, room.id) : new Map<string, string>();

    return jsonResponse({
      ok: true,
      // 게임 중에는 상대 userId 를 anonId 로 바꿔서 내려준다.
      events: isAnonymousPhase(room.status) ? anonymizeEvents(events, session.userId, anonIds) : events,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
