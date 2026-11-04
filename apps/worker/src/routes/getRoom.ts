import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import {
  getAllowedDeep3InterestIds,
  getRoomByCode,
  maskParticipantInterests,
} from "../lib/rooms";
import { getSessionContext, touchSession } from "../lib/session";
import { anonymizeParticipants, buildAnonIdMap, isAnonymousPhase, visibleHostUserId } from "../lib/anonymity";

type ParticipantRow = {
  participantId: string;
  userId: string;
  nickname: string;
  status: string;
  isReady: number;
  interests_json: string;
};

export async function getRoomRoute(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)$/);

    if (!match) {
      return jsonResponse({ ok: false, message: "Invalid path" }, 400);
    }

    const roomCode = match[1];
    const room = await getRoomByCode(env, roomCode);

    if (!room) {
      return jsonResponse({ ok: false, message: "Room not found" }, 404);
    }

    const session = await getSessionContext(request, env);
    const viewerUserId = session?.roomId === room.id ? session.userId : null;
    const allowedDeep3InterestIds = viewerUserId
      ? await getAllowedDeep3InterestIds(env, room.id, viewerUserId)
      : new Set<string>();

    const participantsResult = await env.DB.prepare(
      `
      SELECT
        room_participants.id as participantId,
        room_participants.user_id as userId,
        users.nickname as nickname,
        room_participants.status as status,
        room_participants.is_ready as isReady,
        room_participants.interests_json as interests_json
      FROM room_participants
      INNER JOIN users ON users.id = room_participants.user_id
      WHERE room_participants.room_id = ?
      ORDER BY room_participants.joined_at ASC
      `
    )
      .bind(room.id)
      .all<ParticipantRow>();

    const rows = participantsResult.results ?? [];
    // participantId 는 anonId 를 만드는 재료라서 응답에는 절대 싣지 않는다.
    const publicRows = rows.map(({ participantId: _participantId, ...rest }) => rest);
    const maskedParticipants = publicRows.map((participant) =>
      maskParticipantInterests(participant, viewerUserId, allowedDeep3InterestIds)
    );

    // 게임 시작 이후에는 닉네임/userId 를 익명화한다. (lib/anonymity.ts 설명 참고)
    const anonIds = isAnonymousPhase(room.status)
      ? await buildAnonIdMap(
          room.id,
          rows.map((row) => ({ userId: row.userId, participantId: row.participantId }))
        )
      : new Map<string, string>();

    const visibleParticipants = anonymizeParticipants({
      roomStatus: room.status,
      viewerUserId,
      participants: maskedParticipants,
      anonIds,
    });

    if (session && session.roomId === room.id) {
      await touchSession(env, session.sessionId, new Date().toISOString());
    }

    return jsonResponse({
      ok: true,
      room: {
        code: room.code,
        status: room.status,
        hostUserId: visibleHostUserId(room.status, room.host_user_id, viewerUserId),
      },
      participants: visibleParticipants,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
