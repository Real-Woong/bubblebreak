import { apiRequest } from "./client";
import { ApiError } from "./errors";
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  Deep3RequestBody,
  Deep3RequestResponse,
  GetRoomEventsResponse,
  GetRoomResponse,
  GetRoomSummaryResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  PopBubbleRequest,
  PopBubbleResponse,
  ReadyRoomResponse,
  RoomActionResponse,
  RoomMeResponse,
  StartRoomResponse,
} from '../types/api';

// roomCode가 비어 있으면 /rooms//summary 같은 잘못된 요청이 나가므로 호출 전에 막는다.
function roomPath(roomCode: string, suffix = '') {
  const code = roomCode.trim();
  if (!code) throw new ApiError('방 코드가 비어 있어요', 400, 'EMPTY_ROOM_CODE');
  return `/rooms/${encodeURIComponent(code)}${suffix}`;
}

type SignalOption = { signal?: AbortSignal };

export async function createRoom(body: CreateRoomRequest) {
  return apiRequest<CreateRoomResponse>('/rooms', {
    method: 'POST',
    body,
  });
}

export async function joinRoom(roomCode: string, body: JoinRoomRequest) {
  return apiRequest<JoinRoomResponse>(roomPath(roomCode, `/join`), {
    method: 'POST',
    body,
  });
}

export async function getRoom(roomCode: string, options: SignalOption = {}) {
  return apiRequest<GetRoomResponse>(roomPath(roomCode), { signal: options.signal });
}

export async function getRoomMe(roomCode: string, options: SignalOption = {}) {
  return apiRequest<RoomMeResponse>(roomPath(roomCode, `/me`), { signal: options.signal });
}

export async function readyRoom(roomCode: string) {
  return apiRequest<ReadyRoomResponse>(roomPath(roomCode, `/ready`), {
    method: 'POST',
  });
}

export async function startRoom(roomCode: string) {
  return apiRequest<StartRoomResponse>(roomPath(roomCode, `/start`), {
    method: 'POST',
  });
}

export async function getRoomEvents(roomCode: string, options: SignalOption = {}) {
  return apiRequest<GetRoomEventsResponse>(roomPath(roomCode, `/events`), { signal: options.signal });
}

export async function getRoomSummary(roomCode: string, options: SignalOption = {}) {
  return apiRequest<GetRoomSummaryResponse>(roomPath(roomCode, `/summary`), { signal: options.signal });
}

export async function popBubble(roomCode: string, body: PopBubbleRequest) {
  return apiRequest<PopBubbleResponse>(roomPath(roomCode, `/pop`), {
    method: 'POST',
    body,
  });
}

export async function requestDeep3Unlock(roomCode: string, body: Deep3RequestBody) {
  return apiRequest<Deep3RequestResponse>(roomPath(roomCode, `/deep3-request`), {
    method: 'POST',
    body,
  });
}

export async function approveDeep3Unlock(roomCode: string, eventId: string) {
  return apiRequest<RoomActionResponse>(roomPath(roomCode, `/deep3-request/${eventId}/approve`), {
    method: 'POST',
  });
}

export async function rejectDeep3Unlock(roomCode: string, eventId: string) {
  return apiRequest<RoomActionResponse>(roomPath(roomCode, `/deep3-request/${eventId}/reject`), {
    method: 'POST',
  });
}

export async function leaveRoom(roomCode: string) {
  return apiRequest<RoomActionResponse>(roomPath(roomCode, `/leave`), {
    method: 'POST',
  });
}

export async function finishRoom(roomCode: string) {
  return apiRequest<RoomActionResponse>(roomPath(roomCode, `/finish`), {
    method: 'POST',
  });
}

export async function heartbeat(roomCode: string) {
  return apiRequest<RoomActionResponse>(roomPath(roomCode, `/heartbeat`), {
    method: 'POST',
  });
}
