import { healthRoute } from "./routes/health";
import { healthDbRoute } from "./routes/healthDb";
import { createRoomRoute } from "./routes/createRoom";
import { joinRoomRoute } from "./routes/joinRoom";

// D1에서 INSERT/UPDATE 실행 시 사용하는 최소 결과 타입
// createRoomRoute에서 run().success 확인에 필요
type DbRunResult = {
  success: boolean;
};

// D1에서 사용하는 최소 쿼리 결과 타입
type DbStatement = {
  // SELECT 1건 조회 시 사용
  first<T>(): Promise<T | null>;
  // INSERT/UPDATE/DELETE에서 바인딩 값 주입 시 사용
  bind(...values: unknown[]): DbStatement;
  // 실제 쿼리 실행 시 사용
  run(): Promise<DbRunResult>;
};

// D1 데이터베이스 객체의 최소 형태
// prepare()로 쿼리를 생성하고 실행할 수 있음
type DbLike = {
  prepare(query: string): DbStatement;
};

// Cloudflare Worker 환경 변수 타입
// wrangler.jsonc에서 binding한 DB를 env.DB로 접근
type Env = {
  DB: DbLike;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 요청 URL을 파싱해서 pathname 등을 쉽게 사용하기 위함
    const url = new URL(request.url);

    // 기본 헬스체크 라우트
    // Worker 서버가 정상 동작하는지 확인
    if (request.method === "GET" && url.pathname === "/health") {
      return healthRoute();
    }

    // DB 연결 상태 확인 라우트
    // 실제로 D1에 쿼리를 날려서 응답이 오는지 테스트
    if (request.method === "GET" && url.pathname === "/health/db") {
      return healthDbRoute(env);
    }

    // 방 생성 라우트
    // 프론트에서 닉네임을 받아 users / rooms / room_participants에
    // 순서대로 데이터를 저장하고, 최종적으로 roomCode를 반환
    if (request.method === "POST" && url.pathname === "/rooms") {
      return createRoomRoute(request, env);
    }

    if (request.method === "POST" && /^\/rooms\/[^/]+\/join$/.test(url.pathname)) {
      return joinRoomRoute(request, env);
    }

    // 정의되지 않은 경로는 모두 404 처리
    // 이후 /rooms, /users 등 라우트가 추가되면 위에 계속 분기 추가 예정
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