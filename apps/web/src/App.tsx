import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Interest, Participant, Screen } from './types/bubble';
import type { ApiRoomEvent } from './types/api';
import EntryScreen from './screens/EntryScreen';
import SetupScreen from './screens/SetupScreen';
import LobbyScreen from './screens/LobbyScreen';
import BubbleFieldScreen from './screens/BubbleFieldScreen';
import CommonGroundScreen from './screens/CommonGroundScreen';
import RecommendationScreen from './screens/RecommendationScreen';
import { buildMyInteractions } from './mappers/interactions';

type EntryMode = 'create' | 'join';

const SESSION_STORAGE_KEY = 'bubblebreak.session.v1';

type SavedSessionState = {
  currentScreen: Screen;
  nickname: string;
  mode: EntryMode | null;
  roomCodeInput: string;
  myInterests: Interest[];
  roomCode: string;
  currentUserId: string;
};

function isValidScreen(value: unknown): value is Screen {
  return (
    value === 'entry' ||
    value === 'setup' ||
    value === 'lobby' ||
    value === 'field' ||
    value === 'commonGround' ||
    value === 'recommendation'
  );
}

function readSavedSession(): SavedSessionState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SavedSessionState>;
    if (!isValidScreen(parsed.currentScreen)) return null;

    return {
      currentScreen: parsed.currentScreen,
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
      mode: parsed.mode === 'create' || parsed.mode === 'join' ? parsed.mode : null,
      roomCodeInput: typeof parsed.roomCodeInput === 'string' ? parsed.roomCodeInput : '',
      myInterests: Array.isArray(parsed.myInterests) ? parsed.myInterests : [],
      roomCode: typeof parsed.roomCode === 'string' ? parsed.roomCode : '',
      currentUserId: typeof parsed.currentUserId === 'string' ? parsed.currentUserId : '',
    };
  } catch {
    return null;
  }
}

function getRestoredScreen(savedSession: SavedSessionState | null): Screen {
  if (!savedSession) return 'entry';

  const savedRoomCode = savedSession.roomCode || savedSession.roomCodeInput;

  if (savedSession.currentScreen === 'setup' && savedSession.mode) {
    return 'setup';
  }

  if (
    (savedSession.currentScreen === 'lobby' || savedSession.currentScreen === 'field') &&
    savedRoomCode
  ) {
    return savedSession.currentScreen;
  }

  return 'entry';
}

export default function App() {
  const [savedSession] = useState(readSavedSession);
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => getRestoredScreen(savedSession));
  const [nickname, setNickname] = useState(savedSession?.nickname ?? '');
  const [mode, setMode] = useState<EntryMode | null>(savedSession?.mode ?? null);
  const [roomCodeInput, setRoomCodeInput] = useState(savedSession?.roomCodeInput ?? '');
  const [myInterests, setMyInterests] = useState<Interest[]>(savedSession?.myInterests ?? []);
  const [roomCode, setRoomCode] = useState(savedSession?.roomCode ?? '');
  const [currentUserId, setCurrentUserId] = useState(savedSession?.currentUserId ?? '');
  const [showCommonGround, setShowCommonGround] = useState(false);
  const [selectedBubble, setSelectedBubble] = useState<Interest | null>(null);
  const [fieldParticipants, setFieldParticipants] = useState<Participant[]>([]);
  const [fieldEvents, setFieldEvents] = useState<ApiRoomEvent[]>([]);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const myInteractions = useMemo(
    () => buildMyInteractions(fieldEvents, fieldParticipants, currentUserId),
    [fieldEvents, fieldParticipants, currentUserId]
  );

  // BubbleFieldScreen의 fetchFieldData가 이 함수를 의존성 배열에 넣고 있어서,
  // 매 렌더링마다 새 함수를 만들면 fetchFieldData -> useEffect -> state 갱신 ->
  // 재렌더링 -> 새 함수 재생성으로 이어지는 무한 요청 루프가 생긴다.
  // useCallback으로 참조를 고정해서 이 루프를 막는다.
  const resetSessionState = useCallback((notice?: string) => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setCurrentScreen('entry');
    setMode(null);
    setRoomCode('');
    setRoomCodeInput('');
    setCurrentUserId('');
    setFieldParticipants([]);
    setFieldEvents([]);
    setShowCommonGround(false);
    setSelectedBubble(null);
    setSessionNotice(notice ?? null);
  }, []);

  useEffect(() => {
    const hasSessionData =
      currentScreen !== 'entry' ||
      Boolean(nickname.trim()) ||
      Boolean(roomCodeInput.trim()) ||
      Boolean(roomCode.trim()) ||
      Boolean(currentUserId.trim()) ||
      myInterests.length > 0;

    if (!hasSessionData) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    const session: SavedSessionState = {
      currentScreen,
      nickname,
      mode,
      roomCodeInput,
      myInterests,
      roomCode,
      currentUserId,
    };

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [currentScreen, nickname, mode, roomCodeInput, myInterests, roomCode, currentUserId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50">
      {currentScreen === 'entry' && (
        <EntryScreen
          nickname={nickname}
          setNickname={setNickname}
          roomCodeInput={roomCodeInput}
          setRoomCodeInput={setRoomCodeInput}
          setMode={setMode}
          onNavigate={setCurrentScreen}
          notice={sessionNotice}
          onDismissNotice={() => setSessionNotice(null)}
        />
      )}

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

      {currentScreen === 'lobby' && (
        <LobbyScreen
          roomCode={roomCode || roomCodeInput}
          currentUserId={currentUserId}
          setCurrentUserId={setCurrentUserId}
          onNavigate={setCurrentScreen}
          onResetSession={resetSessionState}
        />
      )}

      {currentScreen === 'field' && (
        <BubbleFieldScreen
          roomCode={roomCode || roomCodeInput}
          currentUserId={currentUserId}
          setCurrentUserId={setCurrentUserId}
          onParticipantsLoaded={setFieldParticipants}
          onEventsLoaded={setFieldEvents}
          onShowCommonGround={() => setShowCommonGround(true)}
          selectedBubble={selectedBubble}
          setSelectedBubble={setSelectedBubble}
          onNavigate={setCurrentScreen}
          onResetSession={resetSessionState}
        />
      )}

      {currentScreen === 'recommendation' && (
        <RecommendationScreen
          roomCode={roomCode || roomCodeInput}
          currentUserId={currentUserId}
          onExit={resetSessionState}
        />
      )}

      {showCommonGround && (
        <CommonGroundScreen
          interactions={myInteractions}
          onClose={() => setShowCommonGround(false)}
        />
      )}
    </div>
  );
}
