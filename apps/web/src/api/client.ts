// API 공통 fetch 유틸
// 이 파일의 목적은:
// 1. API base URL을 한 곳에서 관리하고
// 2. fetch + JSON 파싱 + 에러 처리ㅣ를 공통화하는 것
// 화면 컴포넌ㅌ트에서 fetch를 직접 길게 쓰기 시작하면
// 같은 코드가 여러 군데 반복되기 쉽다
// 그래서 먼저 공통 클라 만든다
// -------------------------------------------

import { appEnv } from "../config/env";
import {
    ApiError,
    ApiUnauthorizedError,
    NETWORK_ERROR_MESSAGE,
    NON_JSON_ERROR_MESSAGE,
    extractErrorInfo,
    localizeErrorMessage,
} from "./errors";

// 기존 import 경로(../api/client)를 유지하기 위해 다시 내보낸다.
export { ApiError, ApiUnauthorizedError };

// -------------------------------------------
// 개발환경 / 배포환경에서 바뀔 수 있는 API주소
// 나중에 .env로 빼기 쉽게 const로 분리
// Vite 환경 변수는 VITE_ 접두사가 필요합니다
// -------------------------------------------
const API_BASE_URL = appEnv.apiBaseUrl;

// -------------------------------------------
// 공통 요청 옵션 타입
// -------------------------------------------
type RequestOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown; // body는 JSON으로 직렬화할 원시값, 객체, 배열 등 모든 타입 허용
    signal?: AbortSignal; // 폴링 중단 등에 사용 (abort되면 AbortError가 그대로 throw됨)
};

// -------------------------------------------
// 공통 API 요청 함수
// 역할:
// - base url + path 합치기
// - JSON body 자동 직렬화
// - content-type이 JSON일 때만 파싱 (SPA fallback HTML 등은 사용자 친화적 에러로 변환)
// - 실패 응답이면 message를 한국어로 바꿔서 ApiError로 throw
// 재네릭 <T>를 쓰는 이유:
// - 호출하는 쪽에서 응답 데이터 타입을 지정할 수 있게 하기 위해
// - 예: apiRequest<GetRoomResponse>(...) 이렇게 하면 응답이 GetRoomResponse 타입으로 추론됨
// -------------------------------------------
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {method = 'GET', body, signal} = options;

    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            // GET 요청에는 body를 보내지 않는다.
            body: body ? JSON.stringify(body) : undefined,
            signal,
        });
    } catch (fetchError) {
        // abort는 호출자가 의도한 취소이므로 그대로 전달한다.
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') throw fetchError;
        throw new ApiError(NETWORK_ERROR_MESSAGE, 0, 'NETWORK_ERROR');
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');

    let data: unknown = null;
    if (isJson) {
        try {
            data = await response.json();
        } catch {
            throw new ApiError(NON_JSON_ERROR_MESSAGE, response.status, 'INVALID_JSON');
        }
    }

    if (!response.ok) {
        const info = extractErrorInfo(data);
        const message = localizeErrorMessage(info.message, response.status);
        if (response.status === 401) {
            throw new ApiUnauthorizedError(message);
        }
        throw new ApiError(message, response.status, info.code);
    }

    // 2xx인데 JSON이 아니면 (예: HTML) 서버 이상으로 본다.
    if (!isJson) {
        throw new ApiError(NON_JSON_ERROR_MESSAGE, response.status, 'NON_JSON_RESPONSE');
    }

    return data as T;
}
