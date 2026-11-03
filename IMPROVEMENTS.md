# BubbleBreak 개선점 정리

> 작성일: 2026-08-26 · 기준 커밋: `b1bdf91`
> 범위: `apps/web`, `apps/worker`, `packages/shared`, 빌드/인프라, 저장소 위생
> 코드 변경 없이 읽기 전용으로 점검한 결과입니다.

---

## 요약

| 우선순위 | 항목 수 | 핵심 |
| --- | --- | --- |
| **P0** | 4 | Tailwind 빌드 파이프라인 부재 · 이벤트 `LIMIT 50` 버그 · 타입체크 공백 · 무인증 방 열람 |
| **P1** | 6 | 죽은 코드 대량 · 폴링 write 증폭 · cleanup 풀스캔 · 원자성 부재 · 라우터 중복 · 1065줄 컴포넌트 |
| **P2** | 8 | 입력 검증 · 룸코드 생성 · 레이트 리밋 · 관측성 · 인덱스 · 접근성 · 에러 처리 · 실행 문서 |

**추천 착수 순서:** ① 죽은 코드 삭제 → ② Tailwind 복구 → ③ 워커 tsconfig + strict → ④ 이벤트 LIMIT → ⑤ getRoom 인증
(①을 먼저 하는 이유: 지우고 나면 ②③에서 손댈 파일이 절반으로 줄어듭니다.)

---

## P0 — 지금 손봐야 하는 것

### 1. Tailwind 빌드 파이프라인이 아예 없음

`apps/web/src/index.css`는 **Tailwind v4가 이미 컴파일해놓은 결과물 2168줄**이 통째로 커밋돼 있습니다.

```css
/*! tailwindcss v4.1.3 | MIT License | https://tailwindcss.com */
```

- `package.json` 어디에도 `tailwindcss`가 없습니다 (`tailwind-merge`, `clsx`만 있고 그마저 `"*"` 와일드카드 버전).
- vite 설정에도 Tailwind 플러그인이 없습니다.
- `main.tsx`가 이 파일을 그냥 `import "./index.css"` 합니다.

**영향:** JSX에 새 유틸리티 클래스를 쓰면 대응 CSS가 생성되지 않아 **조용히 스타일이 안 먹습니다.** 에러도 경고도 없습니다. Figma Make 익스포트 상태 그대로 굳어 있는 것으로 보입니다.

**조치**
- [ ] `tailwindcss` + `@tailwindcss/vite` 설치, vite plugin 등록
- [ ] `index.css`를 `@import "tailwindcss";` + 커스텀 토큰/레이어만 남긴 소스로 교체
- [ ] 현재 2168줄은 백업 후 삭제 (커스텀 CSS 변수 `--color-*` 등은 살려서 `@theme`로 이전)

---

### 2. 이벤트 50개 제한 때문에 열어본 버블이 다시 흐려짐

`apps/worker/src/routes/getRoomEvents.ts:47`

```sql
WHERE room_id = ? AND (source_user_id = ? OR target_user_id = ?)
ORDER BY created_at DESC
LIMIT 50
```

프론트는 이 목록만으로 "내가 이미 연 버블"을 재구성합니다 — `apps/web/src/screens/BubbleFieldScreen.tsx:279`

```tsx
const revealedBubbleKeys = useMemo(() => {
  const keys = new Set<string>();
  events.forEach((event) => {
    if (event.eventType === 'pop' && event.sourceUserId === currentUserId) {
      keys.add(`${event.targetUserId}:${event.interestId}`);
    }
  });
  return keys;
}, [events, currentUserId]);
```

**영향:** 6명 방이면 한 사람 기준 관련 이벤트가 최대 90개(내가 pop 45 + 나를 pop 45)라 **한도에 실제로 닿습니다.** 50을 넘는 순간 예전에 pop 했던 deep2 버블이 다시 블러 처리됩니다.
(deep3 해제는 `getRoom`이 DB에서 매번 재계산하므로 영향 없음)

**조치**
- [ ] pop된 버블 목록을 별도 응답 필드로 전량 내려주거나
- [ ] 커서 페이징 + 프론트에서 누적 (`revealedBubbleKeys`를 서버 상태로 승격)

---

### 3. 타입 체크가 사실상 안 돌고 있음

- `apps/web/tsconfig.json`에 `"strict": true`가 **없습니다.** `noUnusedLocals`/`noUnusedParameters`도 없음 → 암묵적 `any` 통과.
- **`apps/worker`에는 tsconfig.json 자체가 없습니다.** wrangler가 esbuild로 타입 무시하고 번들만 하므로 워커 코드는 타입 검증을 한 번도 받은 적이 없습니다.
- 테스트 파일 0개, ESLint 설정 0개, CI 워크플로 0개.

**조치**
- [ ] `apps/worker/tsconfig.json` 추가 + `@cloudflare/workers-types`
- [ ] 양쪽 `strict: true` (에러 나오는 만큼 점진 수정)
- [ ] 루트 `package.json`에 `typecheck` 스크립트 → GitHub Actions에서 PR마다 실행
- [ ] 최소한 `lib/interests.ts`, `lib/cleanup.ts`, 마스킹 로직에 유닛 테스트

---

### 4. `GET /rooms/:code`에 인증이 없음

`apps/worker/src/routes/getRoom.ts:34`

```ts
const session = await getSessionContext(request, env);
const viewerUserId = session?.roomId === room.id ? session.userId : null;
```

세션이 없으면 `viewerUserId = null`이 되지만 **라우트는 그대로 진행해서 전원의 닉네임 + deep1/deep2 관심사를 전부 반환합니다.** deep3만 `"비공개 관심사"`로 마스킹됩니다.

**영향:** 방 코드만 알면 입장하지 않고도 방 내용을 읽을 수 있습니다. 코드가 단톡방/화면공유로 새면 그대로 노출.

**조치**
- [ ] 세션 필수로 변경, 미인증은 401
- [ ] 미인증 프리뷰가 필요하면 방 존재 여부 + 인원수 + 상태만 반환하는 별도 응답 형태로

---

## P1 — 구조와 비용

### 5. 죽은 코드가 코드베이스의 절반

grep으로 확인한 **참조 0건** 목록:

| 대상 | 규모 | 비고 |
| --- | --- | --- |
| `apps/web/src/components/ui/**` | **48개 파일 전부** | 앱 코드에서 단 한 번도 import 안 함 |
| Radix UI 패키지 | ~30개 | 위 컴포넌트 전용 |
| `recharts`, `cmdk`, `vaul`, `embla-carousel-react`, `react-hook-form`, `react-day-picker`, `input-otp`, `next-themes`, `sonner`, `date-fns` | 10개 | 참조 0건 |
| `hono` (워커 dependency) | — | **한 줄도 안 씀** (라우팅은 수기 if/else) |
| `apps/web/src/mocks/{participantsMock,roomSlotsMock}.ts` | 2개 | 미사용 |
| `apps/web/src/components/figma/ImageWithFallback.tsx` | 1개 | 미사용 |
| `apps/web/src/styles/globals.css` | 1개 | 미사용 |
| `packages/shared/src/index.ts` | — | **빈 파일**인데 워크스페이스로 잡혀 있음 |
| `vite.config.ts` `resolve.alias` | ~40줄 | `"vaul@1.1.2"` 같은 버전 박힌 alias, 전부 위 컴포넌트용 |
| `tsconfig.json` `paths` | ~40줄 | 동일 |

**조치**
- [ ] 위 항목 일괄 삭제 → 설치 시간, 의존성 취약점 표면, vite/tsconfig 설정이 동시에 정리됨
- [ ] `packages/shared`는 실제로 쓸 게 아니면 워크스페이스에서 제거 (쓸 거라면 `Interest`, `RoomStatus` 등 web/worker 공통 타입을 여기로 이전)
- [ ] 남기는 의존성은 `"*"` 대신 실제 버전으로 고정

---

### 6. 폴링이 읽기가 아니라 쓰기를 유발함

`apps/worker/src/lib/session.ts`의 `touchSession()`은 매번

```sql
UPDATE room_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?
```

를 실행하는데, 이걸 `getRoom` / `getRoomEvents` / `getRoomMe` / `getRoomSummary` **읽기 라우트가 전부** 호출합니다.

프론트는 5초마다 `getRoom` + `getRoomEvents`를 병렬 호출 → **유저 1명당 5초에 D1 write 2건.** 6명 방이면 아무도 아무 것도 안 해도 초당 2.4 write. D1은 write가 비싼 쪽입니다. 게다가 탭이 백그라운드여도 계속 돕니다.

**조치**
- [ ] `touchSession`은 heartbeat(30초)에서만 호출
- [ ] `document.visibilityState === 'hidden'`이면 폴링 일시정지
- [ ] 방 상태에 `updated_at` 기반 ETag/버전 넘버 → 변경 없으면 304 또는 빈 델타

---

### 7. cleanup 크론이 풀스캔 + N+1

`apps/worker/src/lib/cleanup.ts:71`, `:112`

```sql
SELECT id, room_id, last_seen_at FROM room_sessions              -- WHERE 없음
SELECT id, status, updated_at, created_at, finished_at FROM rooms -- WHERE 없음
```

그리고 세션마다 추가 SELECT + UPDATE + DELETE 2건, 방마다 COUNT + `deleteRoomData`(5개 이상 statement + 유저당 DELETE 1건).
`*/2 * * * *`로 **2분마다** 실행되므로 방이 늘수록 선형으로 무거워집니다.

**조치**
- [ ] 시간 조건을 SQL로 내리기 (`WHERE last_seen_at < ?`, `WHERE updated_at < ?`)
- [ ] 행별 루프 대신 집합 단위 DELETE 하나 + `env.DB.batch()`
- [ ] 한 회차 처리량 상한(LIMIT)을 두고 다음 회차로 넘기기

---

### 8. 원자성이 없는 지점 3곳

**`createRoom.ts`** — `users` → `rooms` → `room_participants` 3연속 INSERT, 중간 실패 시 롤백 없음 → 고아 레코드. 전체가 바깥 `catch { return 400 "invalid request" }`로 묶여 있어 원인도 안 보입니다.
→ `env.DB.batch()`로 묶기.

**`joinRoom.ts`** — 정원 6명을 COUNT로 확인한 뒤 INSERT. 동시 입장 시 7명 가능.
→ `room_participants`에 인원 제약을 걸거나, `INSERT ... WHERE (SELECT COUNT(*) ...) < 6` 형태로 단일 문장화.

**`popBubble.ts`** — 중복 방지를 SELECT로만 확인, DB 제약 없음. 동시 요청 시 중복 이벤트.
→ `UNIQUE(room_id, event_type, source_user_id, target_user_id, interest_id)` 부분 인덱스.

---

### 9. 라우터/라우트 보일러플레이트 중복

`apps/worker/src/index.ts`는 정규식 `if/else` 18개짜리 수기 라우터입니다. 그리고 **모든 라우트가 각자**

1. URL을 자기 정규식으로 다시 파싱
2. `getSessionContext` 재호출
3. 방 재조회
4. `session.roomId !== room.id` 재확인

를 복붙하고 있습니다 (라우트당 30줄 가까이 동일).

부수적으로: CORS 헤더가 `env.ASSETS.fetch()` 응답에도 붙고, `getCorsHeaders`는 허용 목록에 없는 Origin에도 기본 Origin을 돌려줍니다 (`Allow-Credentials: true`와 함께라 헤더를 생략하는 게 맞음).

**조치**
- [ ] 이미 설치돼 있는 hono 도입 — 파라미터 추출 + 미들웨어로 세션/방 검증 일원화. 안 쓸 거면 의존성 제거.
- [ ] `withRoomSession(handler)` 형태의 래퍼 하나로 3~4번 단계 흡수
- [ ] CORS는 API 경로에만 적용, 미허용 Origin은 헤더 미부착

---

### 10. `BubbleFieldScreen.tsx`가 1065줄

한 파일에 레이아웃 물리 계산(`seededRandom`, `bubblesOverlap`, `findNonOverlappingPosition`, `buildWorldLayout`, `getBubbleMotionValues`), 폴링, 알림 dedupe(`handled*Ref`), 포인터 드래그 카메라, 전체 JSX가 다 들어 있습니다.

**조치**
- [ ] `useRoomPolling` / `useFieldLayout` / `useFieldNotifications` 훅으로 분리 → 각 100~200줄
- [ ] `App.tsx`의 `onParticipantsLoaded` / `onEventsLoaded` 콜백으로 자식 상태를 위로 복제하는 구조도 함께 정리 (과거 무한 요청 루프의 원인이었던 패턴)

---

## P2 — 품질 · 운영

### 11. 닉네임 검증 부재
관심사는 20자 제한이 있는데(`lib/interests.ts`) 닉네임은 `trim()`만 하고 길이/문자 제한이 전무합니다 → UI 깨짐, DB 오염.
→ 1~12자, 공백·제어문자·이모지 정책 결정 후 서버에서 강제.

### 12. 룸코드 생성 (`createRoom.ts:15-22`)
```ts
const index = Math.floor(Math.random() * chars.length);
```
- `crypto`가 아닌 `Math.random()`
- 중복 검사·재시도 없음 → `UNIQUE(code)` 충돌 시 예외가 바깥 catch로 떨어져 사용자에겐 `400 invalid request`가 감

→ `crypto.getRandomValues` + 최대 5회 재시도, 충돌 소진 시 명시적 503.

### 13. 레이트 리밋 전무
어느 엔드포인트에도 없습니다. 특히 `POST /rooms`는 **무인증**이라 방/유저 무한 생성이 가능합니다.
→ Cloudflare Rate Limiting 규칙 또는 KV 기반 IP 카운터.

### 14. 관측성 없음
`wrangler.jsonc`에 `observability` 설정이 없어 Workers Logs가 꺼져 있습니다. 에러 처리는 `console.error`뿐.
→ `"observability": { "enabled": true }` 추가, 요청 ID 기반 구조화 로깅.

### 15. 인덱스 정리 (`migrations/0001_init.sql`)
- `idx_rooms_code`는 `code TEXT NOT NULL UNIQUE`가 이미 만드는 인덱스와 **중복** → 삭제
- 반대로 deep3 허용 조회(`getAllowedDeep3InterestIds`)가 쓰는 `(room_id, event_type, source_user_id, status)` 조합 인덱스가 **없음** → 추가

### 16. 접근성
- 전 화면에 `aria-*` 속성 **0개** (`grep -rc "aria-"` → 0)
- 버블에 `role="button"` + `tabIndex` + Enter/Space 핸들러는 있는데 `className`에 `focus:outline-none focus:ring-0`(`BubbleFieldScreen.tsx:825`)이 있어 **포커스 표시가 지워짐** → 키보드로 위치 파악 불가
- 알림 토스트에 `role="status"` 없음 → 스크린리더가 못 읽음

### 17. 에러 처리
- `ErrorBoundary` 없음 → 렌더 에러 시 화면 백지
- 폴링 실패 시 백오프/재시도 없이 에러 메시지만 세팅 → 일시적 네트워크 오류가 세션 종료처럼 보임

### 18. 실행 스크립트 · 문서
- 루트 `package.json`에 스크립트가 **하나도 없음** (`dev`, `build`, `deploy`, `typecheck`)
- README에 로컬 실행 절차, D1 마이그레이션 적용 방법이 없음
- `_STATUS.md`의 "자주 쓰는 명령" 섹션이 비어 있음

---

## 체크리스트 (착수 순서대로)

- [ ] **①** 죽은 코드 일괄 삭제 (P1-5) — 가장 싸고 뒤 작업을 줄여줌
- [ ] **②** Tailwind 빌드 파이프라인 복구 (P0-1)
- [ ] **③** 워커 tsconfig + 양쪽 `strict` + 루트 `typecheck` 스크립트 (P0-3)
- [ ] **④** 이벤트 `LIMIT 50` 재블러 버그 (P0-2)
- [ ] **⑤** `getRoom` 인증 필수화 (P0-4)
- [ ] ⑥ 폴링 write 감축 + visibility 일시정지 (P1-6)
- [ ] ⑦ `createRoom` batch화 + 룸코드 재시도 (P1-8, P2-12)
- [ ] ⑧ cleanup SQL 최적화 (P1-7)
- [ ] ⑨ 라우터 정리 / hono 도입 여부 결정 (P1-9)
- [ ] ⑩ `BubbleFieldScreen` 분해 (P1-10)
- [ ] ⑪ 나머지 P2 (검증 · 레이트 리밋 · 관측성 · 인덱스 · a11y · ErrorBoundary · 문서)
