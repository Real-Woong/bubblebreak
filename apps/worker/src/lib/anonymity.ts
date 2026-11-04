// 버블 필드 단계의 익명성 처리.
//
// 목표: 대기실(waiting)에서는 닉네임으로 서로 인사하지만, 게임이 시작된(started) 뒤부터 마지막 요약 화면 전까지는
// "누가 어떤 버블의 주인인지"를 서버가 알려주지 않는다.
//
// 설계 (단순히 닉네임만 가리면 우회가 가능하기 때문에 아래를 함께 적용한다):
// 1) 닉네임 -> 별칭("익명 고양이" 등)으로 대체
// 2) userId -> 불투명한 anonId 로 대체. anonId 는 room_participants.id(본인 외에는 모르는 값)로 만든 해시라서
//    대기실에서 본 userId 와 연결할 수 없다. (자기 자신의 userId 는 그대로 준다)
// 3) 대기실 응답에서는 다른 사람의 interests_json 을 숨긴다. (interestId 로 대기실/필드 응답을 대조하는 것을 막기 위함)
// 4) 참여자 순서를 anonId 순으로 섞는다. (입장 순서로 연결하는 것을 막기 위함)
// 5) 방장이 아닌 사람에게는 hostUserId 를 알려주지 않는다.
// 6) 대상 지정 API(pop, deep3-request)는 anonId 로만 받는다. 실제 userId 를 받으면 "userId -> 별칭" 확인 수단이 된다.
//
// 이 파일의 함수들은 DB/Env 에 의존하지 않는 순수 함수(해시 제외)라서 단위 테스트가 가능하다.

export const ALIAS_NAMES = [
  "고양이",
  "토끼",
  "여우",
  "너구리",
  "부엉이",
  "다람쥐",
  "강아지",
  "오리",
  "거북이",
  "하마",
];

export type ParticipantLike = {
  userId: string;
  nickname: string;
  status: string;
  isReady: number;
  interests_json: string;
};

export type EventLike = {
  sourceUserId: string;
  targetUserId: string;
};

export type ParticipantIdRow = {
  userId: string;
  participantId: string;
};

export function isAnonymousPhase(roomStatus: string) {
  return roomStatus !== "waiting";
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// userId -> anonId
export async function buildAnonIdMap(roomId: string, rows: ParticipantIdRow[]): Promise<Map<string, string>> {
  const entries = await Promise.all(
    rows.map(async (row) => {
      const hash = await sha256Hex(`bubblebreak-anon:${roomId}:${row.participantId}`);
      return [row.userId, `a_${hash.slice(0, 24)}`] as const;
    })
  );
  return new Map(entries);
}

function aliasLabel(index: number) {
  return index < ALIAS_NAMES.length ? `익명 ${ALIAS_NAMES[index]}` : `익명 ${index + 1}`;
}

export function anonymizeParticipants<T extends ParticipantLike>(args: {
  roomStatus: string;
  viewerUserId: string | null;
  participants: T[];
  anonIds: Map<string, string>;
}): T[] {
  const { roomStatus, viewerUserId, participants, anonIds } = args;

  if (!isAnonymousPhase(roomStatus)) {
    // 대기실: 닉네임은 그대로 보여주되, 다른 사람의 관심사는 숨긴다.
    return participants.map((participant) =>
      participant.userId === viewerUserId ? participant : { ...participant, interests_json: "[]" }
    );
  }

  // 게임 중/종료: anonId 순으로 정렬하고, 나를 제외한 사람에게 별칭을 붙인다.
  const sorted = [...participants].sort((a, b) =>
    (anonIds.get(a.userId) ?? a.userId).localeCompare(anonIds.get(b.userId) ?? b.userId)
  );
  let aliasIndex = 0;

  return sorted.map((participant) => {
    if (participant.userId === viewerUserId) return participant;

    const label = aliasLabel(aliasIndex++);
    return {
      ...participant,
      userId: anonIds.get(participant.userId) ?? "",
      nickname: label,
      // 대기실의 준비 상태가 필드에서 신원 단서가 되지 않도록 지운다.
      isReady: 0,
    };
  });
}

// 방장 본인에게만 hostUserId 를 알려준다. (게임 중에는 "방장이 누구인지"도 신원 단서)
export function visibleHostUserId(roomStatus: string, hostUserId: string, viewerUserId: string | null) {
  if (!isAnonymousPhase(roomStatus)) return hostUserId;
  return viewerUserId && viewerUserId === hostUserId ? hostUserId : "";
}

export function anonymizeEvents<T extends EventLike>(events: T[], viewerUserId: string, anonIds: Map<string, string>): T[] {
  const map = (userId: string) => (userId === viewerUserId ? userId : anonIds.get(userId) ?? "");
  return events.map((event) => ({
    ...event,
    sourceUserId: map(event.sourceUserId),
    targetUserId: map(event.targetUserId),
  }));
}

// 요청으로 들어온 대상 id(anonId)를 실제 userId 로 바꾼다. 못 찾으면 null.
// 게임 중에는 실제 userId 를 받지 않는다. (userId -> 별칭 확인 수단이 되기 때문)
export function resolveAnonTarget(
  raw: string,
  viewerUserId: string,
  anonIds: Map<string, string>
): string | null {
  for (const [userId, anonId] of anonIds) {
    if (userId !== viewerUserId && anonId === raw) return userId;
  }
  return null;
}

// 요약 응답: 나와 관련된 쌍, 그리고 서로 확인한(mutual) 항목만 남긴다.
type SummaryPairLike<I> = { userAId: string; userBId: string; items: I[] };

export function filterSummaryForViewer<I extends { kind: string }, P extends SummaryPairLike<I>>(
  pairs: P[],
  viewerUserId: string
): P[] {
  return pairs
    .filter((pair) => pair.userAId === viewerUserId || pair.userBId === viewerUserId)
    .map((pair) => ({ ...pair, items: pair.items.filter((item) => item.kind === "mutual") }))
    .filter((pair) => pair.items.length > 0);
}
