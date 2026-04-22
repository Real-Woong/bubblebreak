// API 전용 타입 정의
// 이 파일은 "서버가 어떤 JSON을 내려주는지"를 타입으로 적는 곳이다.
//
// 주의:
// - 화면에서 바로 쓰는 타입과
// - 서버 응답 원본 타입은
// 보통 1:1로 같지 않다.
// 따라서 API 타입은 따로 두는 것이 좋다.
// ============================================================

// 서버가 허용하는 관심사 depth 값
// worker의 validateInterests 규칙과 맞춘다.
export type ApiInterestLevel = 'deep1' | 'deep2' | 'deep3';

// create / join 요청 body에 들어가는 관심사 1개 shape
export type ApiInterest = {
  text: string;
  level: ApiInterestLevel;
};

// ------------------------------------------------------------
// POST /rooms 요청 타입
// 방 생성 시 nickname + interests 를 보낸다.
// ------------------------------------------------------------
export type CreateRoomRequest = {
  nickname: string;
  interests: ApiInterest[];
};

// create room 성공 응답 타입
export type CreateRoomResponse = {
  ok: true;
  roomId: string;
  roomCode: string;
  userId: string;
  nickname: string;
};

// ------------------------------------------------------------
// POST /rooms/:code/join 요청 타입
// join도 nickname + interests 구조는 동일하다.
// ------------------------------------------------------------
export type JoinRoomRequest = {
  nickname: string;
  interests: ApiInterest[];
};

// join room 성공 응답 타입
export type JoinRoomResponse = {
  ok: true;
  roomId: string;
  roomCode: string;
  userId: string;
  nickname: string;
};

// ------------------------------------------------------------
// GET /rooms/:code 응답 타입
// worker가 내려주는 room / participants 구조를 그대로 적는다.
// ------------------------------------------------------------
export type GetRoomResponse = {
  ok: true;
  room: {
    code: string;
    status: string;
    hostUserId: string;
  };
  participants: ApiRoomParticipant[];
};

// room_participants + users join 결과 1행 타입
export type ApiRoomParticipant = {
  userId: string;
  nickname: string;
  status: string;
  isReady: number;
  interests_json: string;
};

// ------------------------------------------------------------
// POST /rooms/:code/ready 요청/응답 타입
// 현재 worker는 body로 userId를 받는다.
// ------------------------------------------------------------
export type ReadyRoomRequest = {
  userId: string;
};

export type ReadyRoomResponse = {
  ok: true;
  roomCode: string;
  userId: string;
  isReady: number;
};

// ------------------------------------------------------------
// POST /rooms/:code/start 요청/응답 타입
// 현재 worker는 host userId를 body로 받는다.
// ------------------------------------------------------------
export type StartRoomRequest = {
  userId: string;
};

export type StartRoomResponse = {
  ok: true;
  roomCode: string;
  status: string;
};

// ------------------------------------------------------------
// 공통 에러 응답 타입
// worker 쪽에서 실패하면 보통 ok: false + message 형태를 준다.
// ------------------------------------------------------------
export type ApiErrorResponse = {
  ok: false;
  message: string;
};