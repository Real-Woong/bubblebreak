// 방 코드 입력 정규화: 모든 공백 제거 + 대문자
export const ROOM_CODE_LENGTH = 6;
export const MAX_ROOM_PARTICIPANTS = 6;

export function normalizeRoomCode(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase().slice(0, ROOM_CODE_LENGTH);
}

// "/join/ABC123" -> "ABC123", 해당 없으면 null
export function parseInviteCodeFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/join\/([A-Za-z0-9]+)\/?$/);
  if (!match) return null;
  const code = normalizeRoomCode(match[1]);
  return code || null;
}

export type JoinabilityInput = {
  room: { status: string };
  participants: Array<{ status: string }>;
};

export type JoinabilityResult = { ok: true } | { ok: false; message: string };

// GET /rooms/:code 응답으로 참여 가능 여부를 판단한다.
export function evaluateJoinability(input: JoinabilityInput): JoinabilityResult {
  if (input.room.status !== 'waiting') {
    return { ok: false, message: '이미 시작됐거나 종료된 방이에요' };
  }
  const joined = input.participants.filter((p) => p.status === 'joined').length;
  if (joined >= MAX_ROOM_PARTICIPANTS) {
    return { ok: false, message: `방이 가득 찼어요 (최대 ${MAX_ROOM_PARTICIPANTS}명)` };
  }
  return { ok: true };
}

export function buildInviteLink(origin: string, roomCode: string): string {
  return `${origin}/join/${roomCode}`;
}
