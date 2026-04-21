import { healthRoute } from "./routes/health";
import { healthDbRoute } from "./routes/healthDb";
import { createRoomRoute } from "./routes/createRoom";
import { joinRoomRoute } from "./routes/joinRoom";
import { getRoomRoute } from "./routes/getRoom";
import { readyRoomRoute } from "./routes/readyRoom";
import { startRoomRoute } from "./routes/startRoom";
import type { Env } from "./lib/db";

// Cloudflare Worker의 진입점
// 모든 HTTP 요청은 먼저 이 fetch 함수로 들어오고,
// 여기서 method + pathname을 기준으로 각 라우트 함수로 분기된다.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // request.url 문자열을 URL 객체로 바꿔 pathname 등을 쉽게 읽는다.
    const url = new URL(request.url);

    // --------------------------------------------------
    // 1. 기본 헬스체크
    // --------------------------------------------------
    // 서버 프로세스 자체가 살아있는지 확인하는 가장 단순한 엔드포인트
    if (request.method === "GET" && url.pathname === "/health") {
      return healthRoute();
    }

    // --------------------------------------------------
    // 2. DB 헬스체크
    // --------------------------------------------------
    // D1 데이터베이스와 실제 통신이 가능한지 확인한다.
    if (request.method === "GET" && url.pathname === "/health/db") {
      return healthDbRoute(env);
    }

    // --------------------------------------------------
    // 3. 방 생성
    // --------------------------------------------------
    // host user 생성 + room 생성 + host participant 생성을 담당
    if (request.method === "POST" && url.pathname === "/rooms") {
      return createRoomRoute(request, env);
    }

    // --------------------------------------------------
    // 4. 방 참가
    // --------------------------------------------------
    // roomCode 기준으로 방에 참가자를 추가한다.
    if (request.method === "POST" && /^\/rooms\/[^/]+\/join$/.test(url.pathname)) {
      return joinRoomRoute(request, env);
    }

    // --------------------------------------------------
    // 5. 방 조회
    // --------------------------------------------------
    // 로비 / BubbleField에서 현재 room 상태를 읽을 때 사용
    if (request.method === "GET" && /^\/rooms\/[^/]+$/.test(url.pathname)) {
      return getRoomRoute(request, env);
    }

    // --------------------------------------------------
    // 6. 준비 완료 처리
    // --------------------------------------------------
    // participant의 is_ready를 1로 올린다.
    if (request.method === "POST" && /^\/rooms\/[^/]+\/ready$/.test(url.pathname)) {
      return readyRoomRoute(request, env);
    }

    // --------------------------------------------------
    // 7. 게임 시작 처리
    // --------------------------------------------------
    // host 권한과 참여자 ready 상태를 확인한 뒤 room.status를 started로 바꾼다.
    if (request.method === "POST" && /^\/rooms\/[^/]+\/start$/.test(url.pathname)) {
      return startRoomRoute(request, env);
    }

    // --------------------------------------------------
    // 8. 정의되지 않은 경로 처리
    // --------------------------------------------------
    // 위 조건에 하나도 걸리지 않으면 지원하지 않는 엔드포인트이므로 404 반환
    return new Response(
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
  },
};
