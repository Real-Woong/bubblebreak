import type { Env } from "./db";
import { jsonResponse } from "./http";
import type { StoredInterest } from "./interests";
import type { SessionContext } from "./session";

type RoomRow = {
  id: string;
  code: string;
  host_user_id: string;
  status: string;
  updated_at?: string | null;
  finished_at?: string | null;
};

type ParticipantRow = {
  userId: string;
  nickname: string;
  status: string;
  isReady: number;
  interests_json: string;
};

type AllowedInterestRow = {
  interest_id: string;
};

export async function getRoomByCode(env: Env, roomCode: string) {
  return env.DB.prepare(
    `
    SELECT id, code, host_user_id, status, updated_at, finished_at
    FROM rooms
    WHERE code = ?
    `
  )
    .bind(roomCode)
    .first<RoomRow>();
}

export async function touchRoomActivity(env: Env, roomId: string, now: string) {
  await env.DB.prepare(
    `
    UPDATE rooms
    SET updated_at = ?
    WHERE id = ?
    `
  )
    .bind(now, roomId)
    .run();
}

export async function markRoomFinished(env: Env, roomId: string, now: string) {
  await env.DB.prepare(
    `
    UPDATE rooms
    SET status = 'finished', updated_at = ?, finished_at = ?
    WHERE id = ?
    `
  )
    .bind(now, now, roomId)
    .run();
}

export async function getAllowedDeep3InterestIds(
  env: Env,
  roomId: string,
  viewerUserId: string
) {
  const result = await env.DB.prepare(
    `
    SELECT interest_id
    FROM room_events
    WHERE room_id = ?
      AND event_type = 'deep3_request'
      AND source_user_id = ?
      AND status = 'accepted'
    `
  )
    .bind(roomId, viewerUserId)
    .all<AllowedInterestRow>();

  return new Set((result.results ?? []).map((row) => row.interest_id));
}

export function maskParticipantInterests(
  participant: ParticipantRow,
  viewerUserId: string | null,
  allowedDeep3InterestIds: Set<string>
) {
  if (!viewerUserId || participant.userId === viewerUserId) {
    return participant;
  }

  const parsed = JSON.parse(participant.interests_json) as StoredInterest[];
  const masked = parsed.map((interest) => {
    if (interest.level !== "deep3") {
      return interest;
    }

    if (allowedDeep3InterestIds.has(interest.interestId)) {
      return interest;
    }

    return {
      ...interest,
      text: "비공개 관심사",
    };
  });

  return {
    ...participant,
    interests_json: JSON.stringify(masked),
  };
}

export function ensureRoomSession(session: SessionContext, roomId: string): Response | null {
  if (session.roomId !== roomId) {
    return jsonResponse({ ok: false, message: "Session does not match room" }, 403);
  }

  return null;
}
