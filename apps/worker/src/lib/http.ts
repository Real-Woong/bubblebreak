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

// 에러 응답을 { error: { code, message } } 형태로 통일하기 위한 헬퍼.
// 기존 라우트가 쓰는 { ok: false, message } 형태와도 호환되도록 두 필드를 함께 내려준다.
export function jsonError(code: string, message: string, status: number): Response {
  return jsonResponse({ ok: false, message, error: { code, message } }, status);
}
