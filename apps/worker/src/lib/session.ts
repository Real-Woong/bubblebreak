import type { Env } from "./db";
import { jsonResponse } from "./http";

export const SESSION_COOKIE_NAME = "bb_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 4;

type SessionRow = {
  id: string;
  room_id: string;
  user_id: string;
  participant_id: string;
  expires_at: string;
  last_seen_at: string;
};

export type SessionContext = {
  sessionId: string;
  roomId: string;
  userId: string;
  participantId: string;
  expiresAt: string;
  lastSeenAt: string;
};

export function buildSessionCookie(sessionId: string) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getCookieValue(cookieHeader: string | null, key: string) {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((item) => item.trim());

  for (const cookie of cookies) {
    const [cookieKey, ...rest] = cookie.split("=");
    if (cookieKey === key) {
      return rest.join("=");
    }
  }

  return null;
}

export function getSessionIdFromRequest(request: Request) {
  return getCookieValue(request.headers.get("Cookie"), SESSION_COOKIE_NAME);
}

export async function createSession(
  env: Env,
  roomId: string,
  userId: string,
  participantId: string,
  now: string
) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await env.DB.prepare(
    `
    INSERT INTO room_sessions (id, room_id, user_id, participant_id, created_at, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(sessionId, roomId, userId, participantId, now, expiresAt, now)
    .run();

  return { sessionId, expiresAt };
}

export async function getSessionContext(
  request: Request,
  env: Env
): Promise<SessionContext | null> {
  const sessionId = getSessionIdFromRequest(request);

  if (!sessionId) {
    return null;
  }

  const session = await env.DB.prepare(
    `
    SELECT id, room_id, user_id, participant_id, expires_at, last_seen_at
    FROM room_sessions
    WHERE id = ?
    `
  )
    .bind(sessionId)
    .first<SessionRow>();

  if (!session) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare(`DELETE FROM room_sessions WHERE id = ?`).bind(sessionId).run();
    return null;
  }

  return {
    sessionId: session.id,
    roomId: session.room_id,
    userId: session.user_id,
    participantId: session.participant_id,
    expiresAt: session.expires_at,
    lastSeenAt: session.last_seen_at,
  };
}

export async function requireSessionContext(
  request: Request,
  env: Env
): Promise<SessionContext | Response> {
  const session = await getSessionContext(request, env);

  if (!session) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
  }

  return session;
}

export async function touchSession(env: Env, sessionId: string, now: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await env.DB.prepare(
    `
    UPDATE room_sessions
    SET last_seen_at = ?, expires_at = ?
    WHERE id = ?
    `
  )
    .bind(now, expiresAt, sessionId)
    .run();
}

