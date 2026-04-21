// 가장 기본적인 서버 상태 확인용 라우트
// 이 함수는 DB 접근 없이 Worker 자체가 살아있는지만 확인한다.
export function healthRoute() {
  // 프론트엔드, curl, 브라우저 등에서 빠르게 확인할 수 있도록
  // 단순하고 예측 가능한 JSON 응답을 반환한다.
  return new Response(
    JSON.stringify({
      // 요청이 정상적으로 처리되었는지 나타내는 공통 플래그
      ok: true,
      // 어떤 Worker가 응답했는지 식별하기 위한 서비스 이름
      service: "bubblebreak-worker",
    }),
    {
      status: 200,
      headers: {
        // 응답 본문이 JSON 형식이라는 점을 명시한다.
        "Content-Type": "application/json",
      },
    }
  );
}
