import type { Env } from "./db";

const WAITING_TTL_MS = 1000 * 60 * 30;
const STARTED_TTL_MS = 1000 * 60 * 15;
const FINISHED_TTL_MS = 1000 * 60 * 5;
const SESSION_STALE_MS = 1000 * 60 * 2;

type RoomCandidate = {
  id: string;
  status: string;
  updated_at: string | null;
  created_at: string;
  finished_at: string | null;
};

type SessionCandidate = {
  id: string;
  room_id: string;
  last_seen_at: string;
};

type CountRow = {
  count: number;
};

async function deleteRoomData(env: Env, roomId: string) {
  const participants = await env.DB.prepare(
    `
    SELECT user_id
    FROM room_participants
    WHERE room_id = ?
    `
  )
    .bind(roomId)
    .all<{ user_id: string }>();

  const userIds = (participants.results ?? []).map((participant) => participant.user_id);

  await env.DB.prepare(`DELETE FROM room_events WHERE room_id = ?`).bind(roomId).run();
  await env.DB.prepare(`DELETE FROM room_sessions WHERE room_id = ?`).bind(roomId).run();
  await env.DB.prepare(`DELETE FROM room_participants WHERE room_id = ?`).bind(roomId).run();
  await env.DB.prepare(`DELETE FROM rooms WHERE id = ?`).bind(roomId).run();

  for (const userId of userIds) {
    await env.DB.prepare(
      `
      DELETE FROM users
      WHERE id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM room_participants
          WHERE user_id = ?
        )
      `
    )
      .bind(userId, userId)
      .run();
  }
}

export async function runRoomCleanup(env: Env) {
  const now = Date.now();
  const nowIso = new Date().toISOString();

  const staleSessions = await env.DB.prepare(
    `
    SELECT id, room_id, last_seen_at
    FROM room_sessions
    `
  ).all<SessionCandidate>();

  for (const session of staleSessions.results ?? []) {
    if (now - new Date(session.last_seen_at).getTime() <= SESSION_STALE_MS) {
      continue;
    }

    const sessionRow = await env.DB.prepare(
      `
      SELECT participant_id
      FROM room_sessions
      WHERE id = ?
      `
    )
      .bind(session.id)
      .first<{ participant_id: string }>();

    if (sessionRow) {
      await env.DB.prepare(
        `
        UPDATE room_participants
        SET status = 'left'
        WHERE id = ?
        `
      )
        .bind(sessionRow.participant_id)
        .run();
    }

    await env.DB.prepare(`DELETE FROM room_sessions WHERE id = ?`).bind(session.id).run();
    await env.DB.prepare(`UPDATE rooms SET updated_at = ? WHERE id = ?`)
      .bind(nowIso, session.room_id)
      .run();
  }

  const rooms = await env.DB.prepare(
    `
    SELECT id, status, updated_at, created_at, finished_at
    FROM rooms
    `
  ).all<RoomCandidate>();

  for (const room of rooms.results ?? []) {
    const activityAt = room.updated_at ?? room.created_at;
    const baseTime = new Date(activityAt).getTime();
    const finishedAt = room.finished_at ? new Date(room.finished_at).getTime() : null;

    let shouldDelete = false;

    if (room.status === "waiting" && now - baseTime > WAITING_TTL_MS) {
      shouldDelete = true;
    }

    if (room.status === "started" && now - baseTime > STARTED_TTL_MS) {
      shouldDelete = true;
    }

    if (room.status === "finished" && finishedAt && now - finishedAt > FINISHED_TTL_MS) {
      shouldDelete = true;
    }

    const joinedParticipants = await env.DB.prepare(
      `
      SELECT COUNT(*) as count
      FROM room_participants
      WHERE room_id = ? AND status = 'joined'
      `
    )
      .bind(room.id)
      .first<CountRow>();

    if (Number(joinedParticipants?.count ?? 0) === 0) {
      shouldDelete = true;
    }

    if (shouldDelete) {
      await deleteRoomData(env, room.id);
    }
  }
}
