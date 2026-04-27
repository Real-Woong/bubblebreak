import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { getRoomByCode, markRoomFinished } from "../lib/rooms";
import { getSessionContext, touchSession } from "../lib/session";

export async function finishRoomRoute(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/finish$/);

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

    if (room.host_user_id !== session.userId) {
      return jsonResponse({ ok: false, message: "Only host can finish the room" }, 403);
    }

    const now = new Date().toISOString();
    await markRoomFinished(env, room.id, now);
    await touchSession(env, session.sessionId, now);

    return jsonResponse({
      ok: true,
      roomCode,
      status: "finished",
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
