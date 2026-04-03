// ============================================================
// 화면 라우팅
// ============================================================
export type Screen = 'entry' | 'setup' | 'lobby' | 'field' | 'commonGround';

// ============================================================
// 관심사 / 버블 깊이
// ============================================================
export type DeepLevel = 'deep1' | 'deep2' | 'deep3';

export interface Interest {
  id: string;
  text: string;
  level: DeepLevel;
}

// ============================================================
// 참여자 / 방 상태
// ============================================================
export interface Participant {
  id: string;
  name: string;
  interests: Interest[];
  color: string;
}

export type ParticipantStatus = 'ready' | 'waiting';

export interface RoomParticipant {
  participantId: string;
  status: ParticipantStatus;
}

export interface EmptyRoomSlot {
  id: string;
  type: 'empty';
}

export interface FilledRoomSlot {
  id: string;
  type: 'participant';
  participant: Participant;
  status: ParticipantStatus;
}

export type RoomSlot = EmptyRoomSlot | FilledRoomSlot;

// ============================================================
// 공통 관심사
// ============================================================
export interface CommonInterest {
  id: string;
  interestId?: string;
  interest: string;
  ownerUserId: string;
  ownerUserName: string;
  matchedUserId: string;
  matchedUserName: string;
  icebreakers: string[];
}

// ============================================================
// 버블 브레이크 이벤트 / 알림
// ============================================================
export interface BubbleBreakEvent {
  id: string;
  actorUserId: string;
  actorUserName: string;
  targetUserId: string;
  targetUserName: string;
  bubbleId: string;
  bubbleText: string;
  bubbleLevel: DeepLevel;
  createdAt: number;
}

export interface BubbleBreakNotification extends BubbleBreakEvent {
  isRead: boolean;
}
