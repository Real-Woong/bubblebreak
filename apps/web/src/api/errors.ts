// API 에러 타입과 한국어 메시지 매핑 (의존성 없는 순수 모듈)

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// 세션 쿠키가 없거나 만료돼서 401을 받은 경우
export class ApiUnauthorizedError extends ApiError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'ApiUnauthorizedError';
  }
}

// 방이 없거나(404) 이 방의 참여자가 아닌(403) 경우처럼 "저장된 세션이 더는 유효하지 않음"을 뜻하는 에러
export function isSessionGoneError(error: unknown): boolean {
  if (error instanceof ApiUnauthorizedError) return true;
  return error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404);
}

export const GENERIC_ERROR_MESSAGE = '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.';
export const NON_JSON_ERROR_MESSAGE = '서버 응답을 해석하지 못했어요. 잠시 후 다시 시도해주세요.';
export const NETWORK_ERROR_MESSAGE = '네트워크 연결을 확인해주세요.';

const MESSAGE_MAP: Record<string, string> = {
  'Room not found': '존재하지 않는 방이에요',
  'Unauthorized': '세션이 만료됐어요. 다시 입장해주세요.',
  'Session does not match room': '이 방의 참여자가 아니에요',
  'Room is not joinable': '이미 시작됐거나 종료된 방이에요',
  'Room is full': '방이 가득 찼어요 (최대 6명)',
  'Room is not in waiting state': '이미 시작된 방이에요',
  'Room is not finished yet': '아직 버블 브레이킹이 끝나지 않았어요',
  'Only host can start the room': '방장만 시작할 수 있어요',
  'Only host can finish the room': '방장만 종료할 수 있어요',
  'All non-host participants must be ready': '모든 참여자가 준비완료해야 시작할 수 있어요',
  'Cannot pop your own bubble': '내 버블은 터뜨릴 수 없어요',
  'Cannot request your own private bubble': '내 비밀 버블에는 요청할 수 없어요',
  'Use deep3 request for private bubbles': '비밀 버블은 확인 요청을 보내야 해요',
  'Only target can approve': '요청을 받은 사람만 수락할 수 있어요',
  'Only target can reject': '요청을 받은 사람만 거절할 수 있어요',
  'Request not found': '요청을 찾을 수 없어요',
  'Participant not found': '참여자를 찾을 수 없어요',
  'Target participant not found': '상대 참여자를 찾을 수 없어요',
  'Interest not found': '관심사를 찾을 수 없어요',
  'Private interest not found': '비밀 관심사를 찾을 수 없어요',
  'Invalid nickname': '닉네임을 확인해주세요',
  'nickname is required': '닉네임을 입력해주세요',
  'Not found': '요청한 주소를 찾을 수 없어요',
  'Method not allowed': '허용되지 않는 요청이에요',
  'Internal error': '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
};

// 서버가 내려준 영문 메시지를 한국어로 바꾼다. 매핑이 없으면 영문을 그대로 노출하지 않고 일반 문구를 쓴다.
export function localizeErrorMessage(message: string | undefined | null, status?: number): string {
  if (message) {
    if (MESSAGE_MAP[message]) return MESSAGE_MAP[message];
    if (/^interest text must be \d+ characters or fewer$/.test(message)) return '관심사는 12자 이내로 입력해주세요';
    if (/can have at most \d+ interests$/.test(message)) return '각 단계에는 관심사를 최대 3개까지 넣을 수 있어요';
    if (/[가-힣]/.test(message)) return message; // 이미 한국어
  }
  if (status === 404) return MESSAGE_MAP['Room not found'];
  if (status === 401) return MESSAGE_MAP['Unauthorized'];
  if (status && status >= 500) return MESSAGE_MAP['Internal error'];
  return GENERIC_ERROR_MESSAGE;
}

// 응답 body에서 { error: { code, message } } 또는 { message } 를 모두 읽는다.
export function extractErrorInfo(data: unknown): { code?: string; message?: string } {
  if (!data || typeof data !== 'object') return {};
  const record = data as { message?: unknown; error?: { code?: unknown; message?: unknown } };
  const nested = record.error && typeof record.error === 'object' ? record.error : undefined;
  const message =
    typeof nested?.message === 'string' ? nested.message : typeof record.message === 'string' ? record.message : undefined;
  const code = typeof nested?.code === 'string' ? nested.code : undefined;
  return { code, message };
}

// 저장된 세션이 더 이상 유효하지 않을 때 홈에서 보여줄 안내 문구
export function sessionGoneMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) return '참여하던 방이 사라져서 처음 화면으로 돌아왔어요.';
  return '세션이 만료됐어요. 다시 입장해주세요.';
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
