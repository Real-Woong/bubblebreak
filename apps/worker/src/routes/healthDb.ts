// 학습 단계용 최소 D1 타입 정의
// 현재 사용하는 기능(prepare → first)만 포함
type DbStatement = {
    first<T>(): Promise<T | null>;
};

type DbLike = {
    prepare(query: string): DbStatement;
};

// Env는 Cloudflare Worker의 환경 변수(binding)를 의미
// DB는 wrangler.jsonc에서 연결한 D1 데이터베이스
type Env = {
    DB: DbLike;
};

// DB 연결 상태 확인용 라우트
// Worker가 D1에 접근해서 쿼리를 실행할 수 있는지 테스트
export async function healthDbRoute(env: Env) {
    // 테이블에 의존하지 않는 간단한 테스트 쿼리
    // SELECT 1을 통해 DB가 정상 응답하는지만 확인
    const result = await env.DB.prepare("SELECT 1 as ok").first<{ ok: number }>();
    
    // 프론트엔드 또는 curl에서 DB 연결 여부를 확인할 수 있도록 JSON 응답 반환
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