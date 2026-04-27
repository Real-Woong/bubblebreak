import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { attachInterestIds, validateInterests, type Interest } from "../lib/interests";
import { getRoomByCode, touchRoomActivity } from "../lib/rooms";
import { buildSessionCookie, createSession } from "../lib/session";

type JoinRoomBody = {
  nickname?: string;
  interests?: Interest[];
};

type CountRow = {
  count: number;
};

export async function joinRoomRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, message: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/join$/);

    if (!match) {
      return jsonResponse({ ok: false, message: "Invalid path" }, 400);
    }

    const roomCode = match[1];
    const body = (await request.json()) as JoinRoomBody;
    const nickname = body.nickname?.trim();
    const interestsResult = validateInterests(body.interests);

    if (!nickname) {
      return jsonResponse({ ok: false, message: "Invalid nickname" }, 400);
    }

    if (interestsResult.ok === false) {
      return jsonResponse({ ok: false, message: interestsResult.message }, 400);
    }

    const room = await getRoomByCode(env, roomCode);

    if (!room) {
      return jsonResponse({ ok: false, message: "Room not found" }, 404);
    }

    if (room.status !== "waiting") {
      return jsonResponse({ ok: false, message: "Room is not joinable" }, 409);
    }

    const countResult = await env.DB.prepare(
      `
      SELECT COUNT(*) as count
      FROM room_participants
      WHERE room_id = ? AND status = 'joined'
      `
    )
      .bind(room.id)
      .first<CountRow>();

    if (Number(countResult?.count ?? 0) >= 6) {
      return jsonResponse({ ok: false, message: "Room is full" }, 409);
    }

    const userId = crypto.randomUUID();
    const participantId = crypto.randomUUID();
    const now = new Date().toISOString();
    const storedInterests = attachInterestIds(interestsResult.interests);
    const interestsJson = JSON.stringify(storedInterests);

    const insertUser = await env.DB.prepare(
      `
      INSERT INTO users (id, nickname, created_at)
      VALUES (?, ?, ?)
      `
    )
      .bind(userId, nickname, now)
      .run();

    if (!insertUser.success) {
      return jsonResponse({ ok: false, message: "Failed to create user" }, 500);
    }

    const insertParticipant = await env.DB.prepare(
      `
      INSERT INTO room_participants (id, room_id, user_id, joined_at, status, interests_json, is_ready)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(participantId, room.id, userId, now, "joined", interestsJson, 0)
      .run();

    if (!insertParticipant.success) {
      return jsonResponse({ ok: false, message: "Failed to join room" }, 500);
    }

    await touchRoomActivity(env, room.id, now);

    const session = await createSession(env, room.id, userId, participantId, now);
    const response = jsonResponse({
      ok: true,
      roomId: room.id,
      roomCode: room.code,
      userId,
      nickname,
    });

    response.headers.append("Set-Cookie", buildSessionCookie(session.sessionId));

    return response;
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
