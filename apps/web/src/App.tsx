import { useMemo, useState } from 'react';

// 프로젝트에서 공통으로 쓰는 타입들
import type { Screen, Interest, Participant } from './types/bubble';

// 각 화면 컴포넌트
import EntryScreen from './screens/EntryScreen';
import SetupScreen from './screens/SetupScreen';
import LobbyScreen from './screens/LobbyScreen';
import BubbleFieldScreen from './screens/BubbleFieldScreen';
import CommonGroundScreen from './screens/CommonGroundScreen';

import { buildCommonInterests } from './mocks/commonInterestsMock';

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

  // 실제 create / join 성공 후 서버가 내려주는 session 값
  const [roomCode, setRoomCode] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  // -----------------------------
  // 4) BubbleField 안에서 공통 관심사 모달 제어용 상태
  // -----------------------------
  const [showCommonGround, setShowCommonGround] = useState(false);

  // 어떤 버블을 눌렀는지 기억하는 상태
  const [selectedBubble, setSelectedBubble] = useState<Interest | null>(null);

  // BubbleField에서 실제 room participants를 읽어오면
  // CommonGround 계산용으로 App에 공유한다.
  const [fieldParticipants, setFieldParticipants] = useState<Participant[]>([]);

  // -----------------------------
  // 5) BubbleField / CommonGround에서 쓸
  // 공통 관심사 데이터 계산
  // -----------------------------
  const commonInterests = useMemo(
    () => buildCommonInterests(fieldParticipants, currentUserId),
    [fieldParticipants, currentUserId]
  );

  // -----------------------------
  // 6) 현재 화면에 따라 컴포넌트 렌더링
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
          setCurrentUserId={setCurrentUserId}
          setRoomCode={setRoomCode}
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
          roomCode={roomCode || roomCodeInput}
          currentUserId={currentUserId}
          onNavigate={setCurrentScreen}
        />
      )}

      {/* -------------------------
          BubbleField 화면
          - 참가자들의 관심사를 버블로 시각화
         ------------------------- */}
      {currentScreen === 'field' && (
        <BubbleFieldScreen
          roomCode={roomCode || roomCodeInput}
          currentUserId={currentUserId}
          onParticipantsLoaded={setFieldParticipants}
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
