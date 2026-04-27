export type ApiInterestLevel = 'deep1' | 'deep2' | 'deep3';

export type ApiInterestInput = {
  text: string;
  level: ApiInterestLevel;
};

export type ApiStoredInterest = {
  interestId: string;
  text: string;
  level: ApiInterestLevel;
};

export type CreateRoomRequest = {
  nickname: string;
  interests: ApiInterestInput[];
};

export type CreateRoomResponse = {
  ok: true;
  roomId: string;
  roomCode: string;
  userId: string;
  nickname: string;
};

export type JoinRoomRequest = {
  nickname: string;
  interests: ApiInterestInput[];
};

export type JoinRoomResponse = {
  ok: true;
  roomId: string;
  roomCode: string;
  userId: string;
  nickname: string;
};

export type GetRoomResponse = {
  ok: true;
  room: {
    code: string;
    status: string;
    hostUserId: string;
  };
  participants: ApiRoomParticipant[];
};

export type ApiRoomParticipant = {
  userId: string;
  nickname: string;
  status: string;
  isReady: number;
  interests_json: string;
};

export type ReadyRoomResponse = {
  ok: true;
  roomCode: string;
  userId: string;
  isReady: number;
};

export type StartRoomResponse = {
  ok: true;
  roomCode: string;
  status: string;
};

export type ApiRoomEventType = 'pop' | 'deep3_request';
export type ApiRoomEventStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export type ApiRoomEvent = {
  id: string;
  eventType: ApiRoomEventType;
  sourceUserId: string;
  targetUserId: string;
  interestId: string;
  status: ApiRoomEventStatus;
  createdAt: string;
  respondedAt: string | null;
};

export type GetRoomEventsResponse = {
  ok: true;
  events: ApiRoomEvent[];
};

export type PopBubbleRequest = {
  targetUserId: string;
  interestId: string;
};

export type PopBubbleResponse = {
  ok: true;
  eventId: string;
  status: 'completed';
};

export type Deep3RequestBody = {
  targetUserId: string;
  interestId: string;
};

export type Deep3RequestResponse = {
  ok: true;
  eventId: string;
  status: ApiRoomEventStatus;
};

export type RoomActionResponse = {
  ok: true;
  eventId?: string;
  roomCode?: string;
  status?: string;
};

export type RoomMeResponse = {
  ok: true;
  me: {
    userId: string;
    participantId: string;
    isReady: number;
    isHost: boolean;
  };
};

export type ApiErrorResponse = {
  ok: false;
  message: string;
};
