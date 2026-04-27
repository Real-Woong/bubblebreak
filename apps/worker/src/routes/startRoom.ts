import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { getRoomByCode } from "../lib/rooms";
import { getSessionContext, touchSession } from "../lib/session";

type CountRow = {
  count: number;
};

export async function startRoomRoute(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/start$/);

    if (!match) {
      return jsonResponse({ ok: false, message: "Invalid path" }, 400);
    }

    const roomCode = match[1];
    const session = await getSessionContext(request, env);

    if (!session) {
      return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
    }

    const room = await getRoomByCode(env, roomCode);

    if (!room) {
      return jsonResponse({ ok: false, message: "Room not found" }, 404);
    }

    if (room.id !== session.roomId) {
      return jsonResponse({ ok: false, message: "Session does not match room" }, 403);
    }

    if (room.host_user_id !== session.userId) {
      return jsonResponse({ ok: false, message: "Only host can start the room" }, 403);
    }

    if (room.status !== "waiting") {
      return jsonResponse({ ok: false, message: "Room is not in waiting state" }, 409);
    }

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
      .bind(room.id, session.userId)
      .first<CountRow>();

    if (Number(pendingParticipants?.count ?? 0) > 0) {
      return jsonResponse(
        { ok: false, message: "All non-host participants must be ready" },
        409
      );
    }

    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      `
      UPDATE rooms
      SET status = 'started', updated_at = ?
      WHERE id = ?
      `
    )
      .bind(now, room.id)
      .run();

    if (!result.success) {
      return jsonResponse({ ok: false, message: "Failed to start room" }, 500);
    }

    await touchSession(env, session.sessionId, now);

    return jsonResponse({
      ok: true,
      roomCode,
      status: "started",
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
