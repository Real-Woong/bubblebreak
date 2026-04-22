// Room 관련 API 함수 모음
// 
// 이 파일은 화면 컴포넌트가 직접 Fetch를 모르게하고,
// "무슨 요청을 보낼지" 만 알면 되게 만드는 역할을 한다.
// 예:
// SetupScreen 에서는
//   createRoom(...)
//   joinRoom(...)
// 만 알면 되고,
//
// LobbyScreen 에서는
//   getRoom(...)
//   readyRoom(...)
//   startRoom(...)
// 만 알면 된다.
// -------------------------------------------
import { apiRequest } from "./client";
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  GetRoomResponse,
  ReadyRoomRequest,
  ReadyRoomResponse,
  StartRoomRequest,
  StartRoomResponse,
} from '../types/api';

// ------------------------------------------------------------
// POST /rooms 
// 새 방 생성
// host user + room + host participant 생성
// ------------------------------------------------------------
export function createRoom(body: CreateRoomRequest) {
    return apiRequest<CreateRoomResponse>('/rooms', {
        method: 'POST',
        body,
    });
}

// ------------------------------------------------------------
// POST /rooms/:code/join
// 기존 방 참가
// ------------------------------------------------------------
export function joinRoom(roomCode: string, body: JoinRoomRequest) {
    return apiRequest<JoinRoomResponse>(`/rooms/${roomCode}/join`, {
        method: 'POST',
        body,
    });
}

// ------------------------------------------------------------
// GET /rooms/:code
// 방 상태 + 참가자 목록 조회
// Lobby / BubbleField 양쪽에서 공통 사용 가능
// ------------------------------------------------------------
export function getRoom(roomCode: string) {
    return apiRequest<GetRoomResponse>(`/rooms/${roomCode}`);
}

// ------------------------------------------------------------
// POST /rooms/:code/ready
// 참가자 준비 상태 토글
// ------------------------------------------------------------
export function readyRoom(roomCode: string, body: ReadyRoomRequest) {
    return apiRequest<ReadyRoomResponse>(`/rooms/${roomCode}/ready`, {
        method: 'POST',
        body,
    });
}

// ------------------------------------------------------------
// POST /rooms/:code/start
// host가 BubbleBreaking 시작
// ------------------------------------------------------------
export function startRoom(roomCode: string, body: StartRoomRequest) {
  return apiRequest<StartRoomResponse>(`/rooms/${roomCode}/start`, {
    method: 'POST',
    body,
  });
}