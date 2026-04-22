// API 공통 fetch 유틸
// 이 파일의 목적은:
// 1. API base URL을 한 곳에서 관리하고
// 2. fetch + JSON 파싱 + 에러 처리ㅣ를 공통화하는 것
// 화면 컴포넌ㅌ트에서 fetch를 직접 길게 쓰기 시작하면
// 같은 코드가 여러 군데 반복되기 쉽다
// 그래서 먼저 공통 클라 만든다
// -------------------------------------------

import type { ApiErrorResponse } from "../types/api";

// -------------------------------------------
// 개발환경 / 배포환경에서 바뀔 수 있는 API주소
// 나중에 .env로 빼기 쉽게 const로 분리
// Vite 환경 변수는 VITE_ 접두사가 필요합니다
// -------------------------------------------
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787';

// -------------------------------------------
// 공통 요청 옵션 타입
// -------------------------------------------
type RequestOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown; // body는 JSON으로 직렬화할 원시값, 객체, 배열 등 모든 타입 허용
};

// -------------------------------------------
// 공통 API 요청 함수
// 역할:
// - base url + path 합치기
// - JSON body 자동 직렬화
// - JSON 응답 자동 파싱
// - 실패 응답이면 message를 읽어서 throw
// 재네릭 <T>를 쓰는 이유:
// - 호출하는 쪽에서 응답 데이터 타입을 지정할 수 있게 하기 위해
// - 예: apiRequest<GetRoomResponse>(...) 이렇게 하면 응답이 GetRoomResponse 타입으로 추론됨
// -------------------------------------------
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {method = 'GET', body} = options;

        const response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            // GET 요청에는 body를 보내지 않는다.
            body: body ? JSON.stringify(body) : undefined,
        });

        // 서버 응답을 먼저 JSON으로 파싱한다.
        // worker는 성공/실패 모두 JSON을 내려주므로 json()을 기대할 수 있다.
        const data = await response.json()

        // response.ok이 false면 HTTP 오류 상태 코드(4xx, 5xx)라는 뜻이므로 에러로 처리한다.
        // 이 경우 서버가 내려준 Message를 최대한 살려서 에러를 던진다.
        if (!response.ok) {
            const error = data as ApiErrorResponse;
            throw new Error(error.message ?? 'API 요청 실패');
        }

        return data as T;
    };