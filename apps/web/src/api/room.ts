import { apiRequest } from "./client";
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  Deep3RequestBody,
  Deep3RequestResponse,
  GetRoomEventsResponse,
  GetRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  PopBubbleRequest,
  PopBubbleResponse,
  ReadyRoomResponse,
  RoomActionResponse,
  RoomMeResponse,
  StartRoomResponse,
} from '../types/api';

export function createRoom(body: CreateRoomRequest) {
  return apiRequest<CreateRoomResponse>('/rooms', {
    method: 'POST',
    body,
  });
}

export function joinRoom(roomCode: string, body: JoinRoomRequest) {
  return apiRequest<JoinRoomResponse>(`/rooms/${roomCode}/join`, {
    method: 'POST',
    body,
  });
}

export function getRoom(roomCode: string) {
  return apiRequest<GetRoomResponse>(`/rooms/${roomCode}`);
}

export function getRoomMe(roomCode: string) {
  return apiRequest<RoomMeResponse>(`/rooms/${roomCode}/me`);
}

export function readyRoom(roomCode: string) {
  return apiRequest<ReadyRoomResponse>(`/rooms/${roomCode}/ready`, {
    method: 'POST',
  });
}

export function startRoom(roomCode: string) {
  return apiRequest<StartRoomResponse>(`/rooms/${roomCode}/start`, {
    method: 'POST',
  });
}

export function getRoomEvents(roomCode: string) {
  return apiRequest<GetRoomEventsResponse>(`/rooms/${roomCode}/events`);
}

export function popBubble(roomCode: string, body: PopBubbleRequest) {
  return apiRequest<PopBubbleResponse>(`/rooms/${roomCode}/pop`, {
    method: 'POST',
    body,
  });
}

export function requestDeep3Unlock(roomCode: string, body: Deep3RequestBody) {
  return apiRequest<Deep3RequestResponse>(`/rooms/${roomCode}/deep3-request`, {
    method: 'POST',
    body,
  });
}

export function approveDeep3Unlock(roomCode: string, eventId: string) {
  return apiRequest<RoomActionResponse>(`/rooms/${roomCode}/deep3-request/${eventId}/approve`, {
    method: 'POST',
  });
}

export function rejectDeep3Unlock(roomCode: string, eventId: string) {
  return apiRequest<RoomActionResponse>(`/rooms/${roomCode}/deep3-request/${eventId}/reject`, {
    method: 'POST',
  });
}

export function leaveRoom(roomCode: string) {
  return apiRequest<RoomActionResponse>(`/rooms/${roomCode}/leave`, {
    method: 'POST',
  });
}

export function finishRoom(roomCode: string) {
  return apiRequest<RoomActionResponse>(`/rooms/${roomCode}/finish`, {
    method: 'POST',
  });
}

export function heartbeat(roomCode: string) {
  return apiRequest<RoomActionResponse>(`/rooms/${roomCode}/heartbeat`, {
    method: 'POST',
  });
}
