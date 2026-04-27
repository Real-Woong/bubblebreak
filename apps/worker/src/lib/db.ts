// D1에서 INSERT / UPDATE / DELETE 실행 후 확인하는 최소 결과 타입
// 현재는 success 여부만 확인하면 충분하므로 이 값만 선언한다.
export type DbRunResult = {
  success: boolean;
};

// Worker 라우트에서 공통으로 쓰는 D1 statement 최소 타입
// 실제 Cloudflare D1 API 전체를 다 쓰는 것이 아니라,
// 현재 프로젝트에서 사용하는 메서드만 골라서 선언한 것이다.
export type DbStatement = {
  // SQL의 ? 자리에 값을 순서대로 넣는다.
  // 예: WHERE code = ? 에 roomCode를 넣을 때 사용
  bind(...values: unknown[]): DbStatement;
  // INSERT / UPDATE / DELETE처럼 데이터를 바꾸는 쿼리를 실행한다.
  run(): Promise<DbRunResult>;
  // SELECT 결과가 1행이라고 기대할 때 사용한다.
  // 결과가 없으면 null이 반환된다.
  first<T>(): Promise<T | null>;
  // SELECT 결과가 여러 행일 수 있을 때 사용한다.
  // D1은 results 배열 안에 데이터를 담아 반환한다.
  all<T>(): Promise<{ results?: T[] }>;
};

// env.DB.prepare(...) 형태로 접근하는 DB 객체 타입
// SQL 문자열을 받아 실행 가능한 statement를 만든다.
export type DbLike = {
  prepare(query: string): DbStatement;
};

// wrangler 바인딩으로 주입되는 Worker 환경 변수 타입
// 현재는 DB 하나만 쓰고 있지만, 이후 KV/R2 등이 추가되면 여기 늘어날 수 있다.
export type Env = {
  DB: DbLike;
  ASSETS: {
    fetch(input: Request | URL | string): Promise<Response>;
  };
};
