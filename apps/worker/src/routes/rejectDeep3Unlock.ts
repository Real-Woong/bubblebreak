import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { getRoomByCode, touchRoomActivity } from "../lib/rooms";
import { getSessionContext, touchSession } from "../lib/session";

type EventRow = {
  target_user_id: string;
  status: string;
};

export async function rejectDeep3UnlockRoute(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/deep3-request\/([^/]+)\/reject$/);

    if (!match) {
      return jsonResponse({ ok: false, message: "Invalid path" }, 400);
    }

    const [, roomCode, eventId] = match;
    const session = await getSessionContext(request, env);
    if (!session) {
      return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
    }

    const room = await getRoomByCode(env, roomCode);
    if (!room) {
      return jsonResponse({ ok: false, message: "Room not found" }, 404);
    }

    if (session.roomId !== room.id) {
      return jsonResponse({ ok: false, message: "Session does not match room" }, 403);
    }

    const event = await env.DB.prepare(
      `
      SELECT target_user_id, status
      FROM room_events
      WHERE id = ? AND room_id = ? AND event_type = 'deep3_request'
      `
    )
      .bind(eventId, room.id)
      .first<EventRow>();

    if (!event) {
      return jsonResponse({ ok: false, message: "Request not found" }, 404);
    }

    if (event.target_user_id !== session.userId) {
      return jsonResponse({ ok: false, message: "Only target can reject" }, 403);
    }

    if (event.status !== "pending") {
      return jsonResponse({ ok: true, eventId, status: event.status });
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      `
      UPDATE room_events
      SET status = 'rejected', responded_at = ?
      WHERE id = ?
      `
    )
      .bind(now, eventId)
      .run();

    await touchRoomActivity(env, room.id, now);
    await touchSession(env, session.sessionId, now);

    return jsonResponse({ ok: true, eventId, status: "rejected" });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
