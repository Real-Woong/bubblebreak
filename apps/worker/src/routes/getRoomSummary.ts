import type { Env } from "../lib/db";
import { jsonResponse } from "../lib/http";
import { getRoomByCode } from "../lib/rooms";
import { getSessionContext, touchSession } from "../lib/session";

type ParticipantRow = {
  userId: string;
  nickname: string;
  interests_json: string;
};

type EventRow = {
  eventType: "pop" | "deep3_request";
  sourceUserId: string;
  targetUserId: string;
  interestId: string;
};

type StoredInterestRow = {
  interestId: string;
  text: string;
  level: "deep1" | "deep2" | "deep3";
};

type DirectedEdge = {
  sourceUserId: string;
  targetUserId: string;
  interestText: string;
  level: "deep1" | "deep2" | "deep3";
};

type SummaryItem =
  | { kind: "mutual"; level: string; interestText: string | null }
  | {
      kind: "oneWay";
      level: string;
      interestText: string | null;
      sourceUserId: string;
      targetUserId: string;
    };

function normalizeText(text: string) {
  return text.trim().toLowerCase();
}

export async function getRoomSummaryRoute(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/summary$/);

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

    if (room.status !== "finished") {
      return jsonResponse({ ok: false, message: "Room is not finished yet" }, 409);
    }

    const viewerUserId = session.userId;

    const participantsResult = await env.DB.prepare(
      `
      SELECT
        room_participants.user_id as userId,
        users.nickname as nickname,
        room_participants.interests_json as interests_json
      FROM room_participants
      INNER JOIN users ON users.id = room_participants.user_id
      WHERE room_participants.room_id = ?
      `
    )
      .bind(room.id)
      .all<ParticipantRow>();

    const participants = participantsResult.results ?? [];
    const nicknameByUserId = new Map(participants.map((p) => [p.userId, p.nickname]));
    const interestsByUserId = new Map(
      participants.map((p) => [
        p.userId,
        new Map(
          (JSON.parse(p.interests_json) as StoredInterestRow[]).map((interest) => [
            interest.interestId,
            interest,
          ])
        ),
      ])
    );

    const eventsResult = await env.DB.prepare(
      `
      SELECT
        event_type as eventType,
        source_user_id as sourceUserId,
        target_user_id as targetUserId,
        interest_id as interestId
      FROM room_events
      WHERE room_id = ?
        AND (
          (event_type = 'pop' AND status = 'completed')
          OR (event_type = 'deep3_request' AND status = 'accepted')
        )
      `
    )
      .bind(room.id)
      .all<EventRow>();

    const edges: DirectedEdge[] = [];

    for (const event of eventsResult.results ?? []) {
      const targetInterest = interestsByUserId.get(event.targetUserId)?.get(event.interestId);
      if (!targetInterest) continue;

      edges.push({
        sourceUserId: event.sourceUserId,
        targetUserId: event.targetUserId,
        interestText: targetInterest.text,
        level: targetInterest.level,
      });
    }

    // (source, target) 정렬 쌍으로 묶는다. pair 안에서 A->B, B->A가 같은
    // 텍스트(정규화 후)를 가리키면 "서로 확인했다"는 의미로 mutual 처리한다.
    const pairKeys = new Map<string, [string, string]>();
    for (const edge of edges) {
      const [a, b] = [edge.sourceUserId, edge.targetUserId].sort();
      pairKeys.set(`${a}|${b}`, [a, b]);
    }

    const maskIfPrivate = (edge: DirectedEdge) => {
      const isDeep3 = edge.level === "deep3";
      const viewerIsParticipant =
        viewerUserId === edge.sourceUserId || viewerUserId === edge.targetUserId;

      return isDeep3 && !viewerIsParticipant ? null : edge.interestText;
    };

    const pairs = Array.from(pairKeys.entries()).map(([key, [idA, idB]]) => {
      const aToB = edges.filter((e) => e.sourceUserId === idA && e.targetUserId === idB);
      const bToA = edges.filter((e) => e.sourceUserId === idB && e.targetUserId === idA);
      const usedBToA = new Set<number>();
      const items: SummaryItem[] = [];

      for (const edge of aToB) {
        const normalized = normalizeText(edge.interestText);
        const matchIndex = bToA.findIndex(
          (candidate, idx) => !usedBToA.has(idx) && normalizeText(candidate.interestText) === normalized
        );

        if (matchIndex !== -1) {
          usedBToA.add(matchIndex);
          items.push({ kind: "mutual", level: edge.level, interestText: maskIfPrivate(edge) });
        } else {
          items.push({
            kind: "oneWay",
            level: edge.level,
            interestText: maskIfPrivate(edge),
            sourceUserId: edge.sourceUserId,
            targetUserId: edge.targetUserId,
          });
        }
      }

      bToA.forEach((edge, idx) => {
        if (usedBToA.has(idx)) return;
        items.push({
          kind: "oneWay",
          level: edge.level,
          interestText: maskIfPrivate(edge),
          sourceUserId: edge.sourceUserId,
          targetUserId: edge.targetUserId,
        });
      });

      return {
        userAId: idA,
        userAName: nicknameByUserId.get(idA) ?? "알 수 없음",
        userBId: idB,
        userBName: nicknameByUserId.get(idB) ?? "알 수 없음",
        items,
        key,
      };
    });

    await touchSession(env, session.sessionId, new Date().toISOString());

    return jsonResponse({
      ok: true,
      pairs: pairs.map(({ key: _key, ...pair }) => pair),
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, message: "Internal error" }, 500);
  }
}
