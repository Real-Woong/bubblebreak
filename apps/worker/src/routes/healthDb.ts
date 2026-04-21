// healthDb 라우트에서 필요한 최소 D1 statement 타입
// 여기서는 단순 조회만 하므로 first()만 선언한다.
type DbStatement = {
  first<T>(): Promise<T | null>;
};

// D1 데이터베이스 객체의 최소 형태
type DbLike = {
  prepare(query: string): DbStatement;
};

// Cloudflare Worker의 환경 변수 타입
// wrangler에서 바인딩한 DB를 env.DB로 주입받는다.
type Env = {
  DB: DbLike;
};

// DB 연결 상태 확인용 라우트
// Worker가 D1에 실제로 접근 가능한지 가장 단순한 쿼리로 검증한다.
export async function healthDbRoute(env: Env) {
  // 1. 테이블 구조에 의존하지 않는 테스트 쿼리 실행
  // SELECT 1은 특정 테이블이 없어도 DB 연결 여부만 확인할 수 있다.
  const result = await env.DB.prepare("SELECT 1 as ok").first<{ ok: number }>();

  // 2. 응답 반환
  // DB가 정상 동작하면 result 안에 { ok: 1 } 형태의 값이 들어온다.
  return new Response(
    JSON.stringify({
      ok: true,
      db: result,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
