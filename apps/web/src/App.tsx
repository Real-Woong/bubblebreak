import { useMemo, useState } from 'react';

// 프로젝트에서 공통으로 쓰는 타입들
import type { Screen, Interest, Participant } from './types/bubble';

// 각 화면 컴포넌트
import EntryScreen from './screens/EntryScreen';
import SetupScreen from './screens/SetupScreen';
import LobbyScreen from './screens/LobbyScreen';
import BubbleFieldScreen from './screens/BubbleFieldScreen';
import CommonGroundScreen from './screens/CommonGroundScreen';

// 아직 백엔드 연결 전이므로 mock 데이터는 유지
import { participantsMock } from './mocks/participantsMock';
import { buildRoomSlots } from './mocks/roomSlotsMock';
import { buildCommonInterests } from './mocks/commonInterestsMock';

// 현재 프론트에서 "나"를 식별하기 위한 임시 user id
// 나중에는 create/join API 응답에서 받은 userId / participantId로 바뀔 예정
const CURRENT_USER_ID = 'me';

// Entry 화면에서 선택한 흐름
// create = 방 만들기
// join = 방 참여하기
type EntryMode = 'create' | 'join';

export default function App() {
  // -----------------------------
  // 1) 지금 어떤 화면을 보고 있는지 관리
  // -----------------------------
  const [currentScreen, setCurrentScreen] = useState<Screen>('entry');

  // -----------------------------
  // 2) EntryScreen에서 받는 "세션 초안" 상태들
  // 이 서비스는 로그인/회원가입이 없기 때문에
  // 우선 프론트에서만 임시 세션 데이터를 들고 간다.
  // -----------------------------

  // 유저가 입력한 닉네임
  const [nickname, setNickname] = useState('');

  // 유저가 방을 만들 건지 / 참여할 건지 선택한 값
  const [mode, setMode] = useState<EntryMode | null>(null);

  // join 흐름일 때 EntryScreen에서 입력한 방 코드
  const [roomCodeInput, setRoomCodeInput] = useState('');

  // SetupScreen에서 입력한 관심사 목록
  // 이 데이터는 나중에 create/join API body로 그대로 들어갈 예정
  const [myInterests, setMyInterests] = useState<Interest[]>([]);

  // -----------------------------
  // 3) 현재는 백엔드 연동 전이므로 임시 roomCode 사용
  // 나중에는:
  // - create 성공 시 POST /rooms 응답의 code
  // - join 성공 시 POST /rooms/:code/join 응답의 code
  // 를 저장해서 써야 함
  // -----------------------------
  const [roomCode] = useState('A8K2P9');

  // -----------------------------
  // 4) BubbleField 안에서 공통 관심사 모달 제어용 상태
  // -----------------------------
  const [showCommonGround, setShowCommonGround] = useState(false);

  // 어떤 버블을 눌렀는지 기억하는 상태
  const [selectedBubble, setSelectedBubble] = useState<Interest | null>(null);

  // -----------------------------
  // 5) 현재 유저 객체 만들기
  // useMemo를 쓰는 이유:
  // nickname 또는 myInterests가 바뀔 때만 다시 계산하려고
  // -----------------------------
  const currentUser: Participant = useMemo(
    () => ({
      id: CURRENT_USER_ID,

      // 닉네임을 안 넣은 상태면 임시로 "나" 표시
      // 나중에는 EntryScreen에서 닉네임 필수 처리할 예정이라
      // 실제 서비스에서는 fallback이 거의 안 쓰일 수 있음
      name: nickname.trim() || '나',

      // 현재 유저 버블 색상
      color: 'from-purple-400 to-pink-400',

      // SetupScreen에서 입력한 내 관심사
      interests: myInterests
    }),
    [nickname, myInterests]
  );

  // -----------------------------
  // 6) 현재 유저 + mock 참가자들을 합쳐서
  // 실제 룸 참여자 목록처럼 사용
  // -----------------------------
  const participants = useMemo<Participant[]>(
    () => [currentUser, ...participantsMock],
    [currentUser]
  );

  // -----------------------------
  // 7) Lobby에서 보여줄 자리(slot) 데이터 생성
  // 예: 최대 6명 방이라면 6개의 슬롯 만들기
  // -----------------------------
  const roomSlots = useMemo(
    () => buildRoomSlots(participants, CURRENT_USER_ID, 6),
    [participants]
  );

  // -----------------------------
  // 8) BubbleField / CommonGround에서 쓸
  // 공통 관심사 데이터 계산
  // -----------------------------
  const commonInterests = useMemo(
    () => buildCommonInterests(participants, CURRENT_USER_ID),
    [participants]
  );

  // -----------------------------
  // 9) 현재 화면에 따라 컴포넌트 렌더링
  // 지금은 라우터 대신 screen state 방식 사용 중
  // -----------------------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50">
      {/* -------------------------
          Entry 화면
          - 닉네임 입력
          - 방 만들기 / 방 참여하기 선택
          - join이면 방 코드 입력
         ------------------------- */}
      {currentScreen === 'entry' && (
        <EntryScreen
          nickname={nickname}
          setNickname={setNickname}
          roomCodeInput={roomCodeInput}
          setRoomCodeInput={setRoomCodeInput}
          setMode={setMode}
          onNavigate={setCurrentScreen}
        />
      )}

      {/* -------------------------
          Setup 화면
          - create / join 공통으로 사용하는 관심사 입력 화면
          - 아직은 API 호출 전 단계
         ------------------------- */}
      {currentScreen === 'setup' && (
        <SetupScreen
          nickname={nickname}
          mode={mode}
          roomCodeInput={roomCodeInput}
          interests={myInterests}
          setInterests={setMyInterests}
          onNavigate={setCurrentScreen}
        />
      )}

      {/* -------------------------
          Lobby 화면
          - create라면 생성된 roomCode 사용
          - join이라면 유저가 입력한 roomCodeInput 우선 사용
         ------------------------- */}
      {currentScreen === 'lobby' && (
        <LobbyScreen
          roomCode={mode === 'join' ? roomCodeInput || roomCode : roomCode}
          slots={roomSlots}
          onNavigate={setCurrentScreen}
        />
      )}

      {/* -------------------------
          BubbleField 화면
          - 참가자들의 관심사를 버블로 시각화
         ------------------------- */}
      {currentScreen === 'field' && (
        <BubbleFieldScreen
          participants={participants}
          currentUserId={CURRENT_USER_ID}
          onShowCommonGround={() => setShowCommonGround(true)}
          selectedBubble={selectedBubble}
          setSelectedBubble={setSelectedBubble}
        />
      )}

      {/* -------------------------
          CommonGround 모달
          - BubbleField 위에 overlay 형태로 뜸
         ------------------------- */}
      {showCommonGround && (
        <CommonGroundScreen
          commonInterests={commonInterests}
          onClose={() => setShowCommonGround(false)}
        />
      )}
    </div>
  );
}