export function healthRoute() {
  // 백엔드 서버가 정상 실행 중인지 확인하기 위한 가장 단순한 응답
  // DB 연결 전, 라우팅/배포/로컬 실행 확인 용도로 먼저 만든다
  return new Response(
    JSON.stringify({
      ok: true,
      service: "bubblebreak-worker",
    }),
    {
      status: 200,
      headers: {
        // 응답 본문이 JSON 형식임을 명시
        "Content-Type": "application/json",
      },
    }
  );
}