import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { getRoomByCode } from "../lib/rooms";
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

    return jsonResponse({
      ok: true,
      events: result.results ?? [],
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
