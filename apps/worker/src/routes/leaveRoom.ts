import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { clearSessionCookie, getSessionContext } from "../lib/session";
import { getRoomByCode, markRoomFinished, touchRoomActivity } from "../lib/rooms";

type CountRow = {
  count: number;
};

export async function leaveRoomRoute(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/leave$/);

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

    if (session.roomId !== room.id) {
      return jsonResponse({ ok: false, message: "Session does not match room" }, 403);
    }

    const now = new Date().toISOString();

    await env.DB.prepare(
      `
      UPDATE room_participants
      SET status = 'left'
      WHERE id = ?
      `
    )
      .bind(session.participantId)
      .run();

    await env.DB.prepare(`DELETE FROM room_sessions WHERE id = ?`).bind(session.sessionId).run();
    await touchRoomActivity(env, room.id, now);

    const joinedParticipants = await env.DB.prepare(
      `
      SELECT COUNT(*) as count
      FROM room_participants
      WHERE room_id = ? AND status = 'joined'
      `
    )
      .bind(room.id)
      .first<CountRow>();

    if (room.host_user_id === session.userId || Number(joinedParticipants?.count ?? 0) === 0) {
      await markRoomFinished(env, room.id, now);
    }

    const response = jsonResponse({ ok: true });
    response.headers.append("Set-Cookie", clearSessionCookie());
    return response;
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
