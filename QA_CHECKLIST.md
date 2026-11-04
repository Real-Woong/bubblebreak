# QA 수정 수동 검증 체크리스트

자동 테스트: `yarn workspace @bubblebreak/web test` (세션/에러 매핑, 방 코드 검증, 관심사 입력 정규화, 버블 텍스트 맞춤)
실행 불가였던 항목(Workers 라우팅, 브라우저 동작)은 아래를 배포/`wrangler dev` 후 직접 확인.

## P0
- [ ] 방 만들기 → 대기실 → "방 나가기": 홈으로 이동, "완료" 화면/JSON 파싱 에러 없음. Network 탭에 leave 이후 `GET /rooms/:code`, `/rooms//summary` 가 없어야 함
- [ ] `curl -i https://<host>/rooms/ABC/nope` → `404` + `application/json` + `{"error":{"code":"NOT_FOUND",...}}` (HTML 아님)
- [ ] `curl -i https://<host>/join/ABC123 -H 'Sec-Fetch-Mode: navigate'` → 200 `text/html` (SPA)
- [ ] localStorage `bubblebreak.session.v1` 에 없는 방 코드(lobby)를 넣고 새로고침 → 홈 + 안내 문구, 폴링/요청 반복 없음
- [ ] 대기실에서 폴링 중 방이 사라지면(404) 홈으로 이동하고 폴링이 멈춤
- [ ] 홈에서 `ZZZZZZ` → "방 참여하기": 홈에 "존재하지 않는 방 코드예요", 관심사 화면으로 안 넘어감
- [ ] 6명 찬 방 / 시작된 방 코드 → 각각 가득 참 / 시작됨 메시지
- [ ] 코드 비움 → 참여 버튼 비활성 + 안내 문구. ` abc123 ` 입력 → `ABC123`
- [ ] 관심사 "맛집" 추가 후 다시 "맛집" Enter → 입력창 비워지고 "이미 추가한 관심사예요"
- [ ] 한글 입력 중 Enter(조합 중) → 추가되지 않음, 조합 끝난 뒤 Enter → 추가됨. 공백만 입력 → 무시

## P1
- [ ] `/join/ABC123` 접속 → 코드 자동 입력 + 초대 배너, 닉네임만 넣고 참여 → 정상 입장. 주소는 `/` 로 정리됨
- [ ] 대기실 "초대 링크 복사" → `https://<host>/join/CODE` 복사됨. 모바일에서 공유 버튼 노출/동작
- [ ] 대기실에 "현재 방 상태" 텍스트 없음, 안내 문구 1개만 표시. 영문 에러("Room not found" 등) 노출 없음
- [ ] 12자 관심사가 미리보기/BubbleField 원 안에 들어옴, 입력창에 `n/12` 카운터
- [ ] 1420×710 에서 "방 만들기" 버튼이 스크롤 없이 보임. 390px 폭에서도 확인
- [ ] "방 나가기" 버튼 대비 확인(빨강 700 on 흰색 ≈ 6.5:1)
- [ ] 스크린리더/DevTools 로 아이콘 버튼 aria-label 확인 (뒤로가기, 방 코드 복사, 관심사 추가/삭제, 닫기 등)
- [ ] 화면 전환(홈→관심사→대기실) 시 항상 맨 위에서 시작

- [ ] 요약(완료) 화면에서 새로고침 → 방이 남아 있으면 요약이 다시 보임, 방이 정리된 뒤(약 5분)면 홈 + 안내 문구
- [ ] 버블 필드 로딩 화면에 영어 문구("room participants")가 없음

## 서버 익명화 (필드 단계)
자동 검증: `yarn workspace @bubblebreak/worker test` (단위) · `yarn workspace @bubblebreak/worker test:e2e` (실제 Worker 코드를 SQLite 위에서 전체 흐름 실행)
- [ ] 대기실에서는 닉네임이 보이고, 방 시작 후 버블 필드에서는 다른 사람이 "익명 고양이" 같은 별칭으로만 보임
- [ ] 필드의 Network 탭(`GET /rooms/:code`, `/events`)에 다른 사람의 닉네임/실제 userId가 없음 (userId는 `a_…` 형태)
- [ ] 방장이 아닌 계정의 `room.hostUserId` 가 빈 문자열
- [ ] 버블 터뜨리기 / 비밀 취향 요청 / 수락 동작 (별칭 ID로 대상 지정)
- [ ] 완료 화면에서만 실제 닉네임으로 "OO님도 맛집에 관심이 있어요" 표시
- [ ] 완료 화면의 `/summary` 응답에 내가 속하지 않은 쌍과 한쪽만 확인한 항목(oneWay)이 없음

## P2
- [ ] `https://<host>/og-image.png` 가 1200×630 으로 열림 (현재는 로고 기반 플레이스홀더). 카드 미리보기에서 summary_large_image 확인

## 회귀
- [ ] 방 생성 → 참여 → 준비완료 → 시작 → 버블 터뜨리기 → 완료/요약 화면
