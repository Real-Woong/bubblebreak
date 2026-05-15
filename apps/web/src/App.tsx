import { useEffect, useMemo, useState } from 'react';
import type { Interest, Participant, Screen } from './types/bubble';
import EntryScreen from './screens/EntryScreen';
import SetupScreen from './screens/SetupScreen';
import LobbyScreen from './screens/LobbyScreen';
import BubbleFieldScreen from './screens/BubbleFieldScreen';
import CommonGroundScreen from './screens/CommonGroundScreen';
import RecommendationScreen from './screens/RecommendationScreen';
import { buildCommonInterests } from './mocks/commonInterestsMock';

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

  const commonInterests = useMemo(
    () => buildCommonInterests(fieldParticipants, currentUserId),
    [fieldParticipants, currentUserId]
  );

  const resetSessionState = () => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setCurrentScreen('entry');
    setMode(null);
    setRoomCode('');
    setRoomCodeInput('');
    setCurrentUserId('');
    setFieldParticipants([]);
    setShowCommonGround(false);
    setSelectedBubble(null);
  };

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
          onShowCommonGround={() => setShowCommonGround(true)}
          selectedBubble={selectedBubble}
          setSelectedBubble={setSelectedBubble}
          onNavigate={setCurrentScreen}
          onResetSession={resetSessionState}
        />
      )}

      {currentScreen === 'recommendation' && (
        <RecommendationScreen
          commonInterests={commonInterests}
          participants={fieldParticipants}
          currentUserId={currentUserId}
          onExit={resetSessionState}
        />
      )}

      {showCommonGround && (
        <CommonGroundScreen
          commonInterests={commonInterests}
          onClose={() => setShowCommonGround(false)}
        />
      )}
    </div>
  );
}
