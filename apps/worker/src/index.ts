import { healthRoute } from "./routes/health";
import { healthDbRoute } from "./routes/healthDb";
import { createRoomRoute } from "./routes/createRoom";
import { joinRoomRoute } from "./routes/joinRoom";
import { getRoomRoute } from "./routes/getRoom";
import { readyRoomRoute } from "./routes/readyRoom";
import { startRoomRoute } from "./routes/startRoom";
import type { Env } from "./lib/db";

// 로컬 개발에서 FE와 BE의 origin이 달라질 수 있으므로
// 허용할 FE 주소 목록을 미리 정해둔다.
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

// 요청의 Origin 헤더를 보고 적절한 CORS 응답 헤더를 만든다.
// FE 주소가 허용 목록에 있으면 그 값을 그대로 돌려주고,
// 없으면 기본 개발 주소(localhost:3000)로 응답한다.
function getCorsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "http://localhost:3000";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

// Cloudflare Worker의 진입점
// 모든 HTTP 요청은 먼저 이 fetch 함수로 들어오고,
// 여기서 method + pathname을 기준으로 각 라우트 함수로 분기된다.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // request.url 문자열을 URL 객체로 바꿔 pathname 등을 쉽게 읽는다.
    const url = new URL(request.url);
    const requestOrigin = request.headers.get("Origin");

    // --------------------------------------------------
    // 0. CORS preflight 처리
    // --------------------------------------------------
    // 브라우저는 실제 POST 전에 OPTIONS 요청으로
    // "이 origin에서 이 메서드를 써도 되는지" 먼저 확인할 수 있다.
    // 이 요청을 처리하지 않으면 FE에서 실제 API 호출 전에 막힌다.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(requestOrigin),
      });
    }

    let response: Response;

    // --------------------------------------------------
    // 1. 기본 헬스체크
    // --------------------------------------------------
    // 서버 프로세스 자체가 살아있는지 확인하는 가장 단순한 엔드포인트
    if (request.method === "GET" && url.pathname === "/health") {
      response = healthRoute();
    } else if (request.method === "GET" && url.pathname === "/health/db") {
      // --------------------------------------------------
      // 2. DB 헬스체크
      // --------------------------------------------------
      // D1 데이터베이스와 실제 통신이 가능한지 확인한다.
      response = await healthDbRoute(env);
    } else if (request.method === "POST" && url.pathname === "/rooms") {
      // --------------------------------------------------
      // 3. 방 생성
      // --------------------------------------------------
      // host user 생성 + room 생성 + host participant 생성을 담당
      response = await createRoomRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/join$/.test(url.pathname)) {
      // --------------------------------------------------
      // 4. 방 참가
      // --------------------------------------------------
      // roomCode 기준으로 방에 참가자를 추가한다.
      response = await joinRoomRoute(request, env);
    } else if (request.method === "GET" && /^\/rooms\/[^/]+$/.test(url.pathname)) {
      // --------------------------------------------------
      // 5. 방 조회
      // --------------------------------------------------
      // 로비 / BubbleField에서 현재 room 상태를 읽을 때 사용
      response = await getRoomRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/ready$/.test(url.pathname)) {
      // --------------------------------------------------
      // 6. 준비 완료 처리
      // --------------------------------------------------
      // participant의 is_ready를 1로 올린다.
      response = await readyRoomRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/start$/.test(url.pathname)) {
      // --------------------------------------------------
      // 7. 게임 시작 처리
      // --------------------------------------------------
      // host 권한과 참여자 ready 상태를 확인한 뒤 room.status를 started로 바꾼다.
      response = await startRoomRoute(request, env);
    } else {
      // --------------------------------------------------
      // 8. 정의되지 않은 경로 처리
      // --------------------------------------------------
      // 위 조건에 하나도 걸리지 않으면 지원하지 않는 엔드포인트이므로 404 반환
      response = new Response(
        JSON.stringify({
          ok: false,
          message: "Not Found",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 실제 GET/POST 응답에도 CORS 헤더를 붙여야
    // 브라우저가 FE 쪽 JavaScript에게 응답을 전달해준다.
    for (const [key, value] of Object.entries(getCorsHeaders(requestOrigin))) {
      response.headers.set(key, value);
    }

    return response;
  },
};
