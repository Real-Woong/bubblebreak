import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { attachInterestIds, validateInterests, type Interest } from "../lib/interests";
import { buildSessionCookie, createSession } from "../lib/session";

type CreateRoomBody = {
  nickname?: string;
  interests?: Interest[];
};

function generateId() {
  return crypto.randomUUID();
}

function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * chars.length);
    result += chars[index];
  }

  return result;
}

export async function createRoomRoute(request: Request, env: Env) {
  try {
    const body = (await request.json()) as CreateRoomBody;
    const nickname = body.nickname?.trim();
    const interestsResult = validateInterests(body.interests);

    if (!nickname) {
      return jsonResponse({ ok: false, message: "nickname is required" }, 400);
    }

    if (interestsResult.ok === false) {
      return jsonResponse({ ok: false, message: interestsResult.message }, 400);
    }

    const userId = generateId();
    const roomId = generateId();
    const participantId = generateId();
    const roomCode = generateRoomCode();
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
      return jsonResponse({ ok: false, message: "failed to create user" }, 500);
    }

    const insertRoom = await env.DB.prepare(
      `
      INSERT INTO rooms (id, code, host_user_id, status, created_at, updated_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(roomId, roomCode, userId, "waiting", now, now, null)
      .run();

    if (!insertRoom.success) {
      return jsonResponse({ ok: false, message: "failed to create room" }, 500);
    }

    const insertParticipant = await env.DB.prepare(
      `
      INSERT INTO room_participants (id, room_id, user_id, joined_at, status, interests_json, is_ready)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(participantId, roomId, userId, now, "joined", interestsJson, 0)
      .run();

    if (!insertParticipant.success) {
      return jsonResponse({ ok: false, message: "failed to add host as participant" }, 500);
    }

    const session = await createSession(env, roomId, userId, participantId, now);
    const response = jsonResponse(
      {
        ok: true,
        roomId,
        roomCode,
        userId,
        nickname,
      },
      201
    );

    response.headers.append("Set-Cookie", buildSessionCookie(session.sessionId));

    return response;
  } catch {
    return jsonResponse({ ok: false, message: "invalid request" }, 400);
  }
}
