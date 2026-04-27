import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { getRoomByCode, touchRoomActivity } from "../lib/rooms";
import { getSessionContext, touchSession } from "../lib/session";

type PopBody = {
  targetUserId?: string;
  interestId?: string;
};

type ParticipantInterestRow = {
  interests_json: string;
};

export async function popBubbleRoute(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/pop$/);

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

    const body = (await request.json()) as PopBody;
    const targetUserId = body.targetUserId?.trim();
    const interestId = body.interestId?.trim();

    if (!targetUserId || !interestId) {
      return jsonResponse({ ok: false, message: "targetUserId and interestId are required" }, 400);
    }

    if (targetUserId === session.userId) {
      return jsonResponse({ ok: false, message: "Cannot pop your own bubble" }, 409);
    }

    const participant = await env.DB.prepare(
      `
      SELECT interests_json
      FROM room_participants
      WHERE room_id = ? AND user_id = ? AND status = 'joined'
      `
    )
      .bind(room.id, targetUserId)
      .first<ParticipantInterestRow>();

    if (!participant) {
      return jsonResponse({ ok: false, message: "Target participant not found" }, 404);
    }

    const interests = JSON.parse(participant.interests_json) as Array<{
      interestId: string;
      level: string;
    }>;
    const matchedInterest = interests.find((interest) => interest.interestId === interestId);

    if (!matchedInterest) {
      return jsonResponse({ ok: false, message: "Interest not found" }, 404);
    }

    if (matchedInterest.level === "deep3") {
      return jsonResponse({ ok: false, message: "Use deep3 request for private bubbles" }, 409);
    }

    const eventId = crypto.randomUUID();
    const now = new Date().toISOString();

    const result = await env.DB.prepare(
      `
      INSERT INTO room_events (
        id,
        room_id,
        event_type,
        source_user_id,
        target_user_id,
        interest_id,
        status,
        created_at,
        responded_at
      )
      VALUES (?, ?, 'pop', ?, ?, ?, 'completed', ?, ?)
      `
    )
      .bind(eventId, room.id, session.userId, targetUserId, interestId, now, now)
      .run();

    if (!result.success) {
      return jsonResponse({ ok: false, message: "Failed to create pop event" }, 500);
    }

    await touchRoomActivity(env, room.id, now);
    await touchSession(env, session.sessionId, now);

    return jsonResponse({
      ok: true,
      eventId,
      status: "completed",
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
