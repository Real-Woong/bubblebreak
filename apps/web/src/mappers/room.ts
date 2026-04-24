// Room API 응답 -> 화면용 타입 변환기
//
// 이 파일의 목적:
// 서버가 내려준 "원본 JSON"을
// 현재 web UI가 쓰는 타입으로 바꾸는 것
//
// 왜 필요한가?
// - API 응답은 DB 구조에 가깝다.
// - UI 타입은 화면 렌더링에 가깝다.
// 둘은 보통 다르기 때문에 중간 변환 단계가 필요하다.


// 서버가 저장한 interestId를 그대로 UI Interest.id로 사용한다.
// ============================================================

import type { ApiRoomParticipant, ApiStoredInterest } from '../types/api';
import type {
  Interest,
  Participant,
  ParticipantStatus,
  RoomSlot,
} from '../types/bubble';

// ------------------------------------------------------------
// interests_json 문자열을 Interest[] 로 파싱
//
// worker는 interests_json 을 문자열로 내려준다.
// 따라서 FE에서는 JSON.parse가 필요하다.
//
// 주의:
// 현재 UI Interest 타입은 id 필드가 필요하며,
// 그 값은 FE 임시값이 아니라 서버가 저장한 interestId를 그대로 사용한다.
// ------------------------------------------------------------
export function parseInterestsJson(interestsJson: string): Interest[] {
  const parsed = JSON.parse(interestsJson) as ApiStoredInterest[];

  return parsed.map((interest) => ({
    id: interest.interestId,
    text: interest.text,
    level: interest.level,
  }));
}

// ------------------------------------------------------------
// isReady 숫자값을 화면용 status 문자열로 변환
//
// 서버:
// - 0
// - 1
//
// 화면:
// - 'waiting'
// - 'ready'
// ------------------------------------------------------------
export function mapReadyToStatus(isReady: number): ParticipantStatus {
  return isReady === 1 ? 'ready' : 'waiting';
}

// ------------------------------------------------------------
// API participant 1개를 화면용 Participant로 변환
//
// 현재 UI의 Participant 타입은:
// - id
// - name
// - interests
// - color
// 를 필요로 한다.
//
// color는 아직 서버에 없으므로 FE에서 임시 규칙으로 부여한다.
// ------------------------------------------------------------
export function mapApiParticipantToParticipant(
  apiParticipant: ApiRoomParticipant,
  color: string
): Participant {
  return {
    id: apiParticipant.userId,
    name: apiParticipant.nickname,
    interests: parseInterestsJson(apiParticipant.interests_json),
    color,
  };
}

// ------------------------------------------------------------
// participantId 기준으로 임시 색상을 정하는 함수
//
// 현재 BubbleField/Lobby UI는 color를 기대하지만
// 서버는 색상 정보를 내려주지 않는다.
// 따라서 FE에서 임시 규칙으로 색상을 만들어 쓴다.
//
// 나중에 더 정교하게 바꾸고 싶으면 여기만 수정하면 된다.
// ------------------------------------------------------------
export function getParticipantColor(index: number) {
  const colors = [
    'from-purple-400 to-pink-400',
    'from-pink-400 to-rose-400',
    'from-violet-400 to-purple-500',
    'from-sky-400 to-cyan-500',
    'from-lime-400 to-green-500',
    'from-yellow-300 to-amber-400',
  ];

  return colors[index % colors.length];
}

// ------------------------------------------------------------
// GET /rooms/:code 응답 participants를
// 현재 Lobby / BubbleField가 쓰는 Participant[]로 변환
// ------------------------------------------------------------
export function mapApiParticipantsToParticipants(apiParticipants: ApiRoomParticipant[]) {
  return apiParticipants.map((apiParticipant, index) =>
    mapApiParticipantToParticipant(apiParticipant, getParticipantColor(index))
  );
}

// ------------------------------------------------------------
// GET /rooms/:code 응답 participants를
// Lobby의 RoomSlot[] 구조로 변환
//
// 현재 Lobby UI는 최대 6명 슬롯 구조를 기대한다.
// 따라서:
// 1. participant slot을 먼저 만들고
// 2. 남는 칸은 empty slot으로 채운다.
// ------------------------------------------------------------
export function mapApiParticipantsToRoomSlots(
  apiParticipants: ApiRoomParticipant[],
  maxSlots = 6
): RoomSlot[] {
  const participantSlots: RoomSlot[] = apiParticipants.map((apiParticipant, index) => ({
    id: `slot-${apiParticipant.userId}`,
    type: 'participant',
    participant: mapApiParticipantToParticipant(apiParticipant, getParticipantColor(index)),
    status: mapReadyToStatus(apiParticipant.isReady),
  }));

  const emptyCount = Math.max(0, maxSlots - participantSlots.length);

  const emptySlots: RoomSlot[] = Array.from({ length: emptyCount }, (_, index) => ({
    id: `empty-${index}`,
    type: 'empty',
  }));

  return [...participantSlots, ...emptySlots];
}
