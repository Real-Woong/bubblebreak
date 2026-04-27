import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { getRoomByCode } from "../lib/rooms";
import { getSessionContext, touchSession } from "../lib/session";

type ParticipantRow = {
  user_id: string;
  is_ready: number;
};

export async function getRoomMeRoute(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/me$/);

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

    const participant = await env.DB.prepare(
      `
      SELECT user_id, is_ready
      FROM room_participants
      WHERE id = ?
      `
    )
      .bind(session.participantId)
      .first<ParticipantRow>();

    if (!participant) {
      return jsonResponse({ ok: false, message: "Participant not found" }, 404);
    }

    await touchSession(env, session.sessionId, new Date().toISOString());

    return jsonResponse({
      ok: true,
      me: {
        userId: session.userId,
        participantId: session.participantId,
        isReady: participant.is_ready,
        isHost: room.host_user_id === session.userId,
      },
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
