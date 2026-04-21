// JSON 응답을 매번 같은 형태로 만들기 위한 헬퍼 함수
// 각 라우트에서 new Response를 반복 작성하지 않도록 공통화했다.
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    // 기본값은 200이지만, 필요하면 400/404/500 등을 직접 넘긴다.
    status,
    headers: {
      // 프론트엔드가 JSON 응답으로 해석할 수 있도록 Content-Type을 고정한다.
      "Content-Type": "application/json",
    },
  });
}
