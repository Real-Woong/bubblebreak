import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Interest, Participant, Screen } from './types/bubble';
import type { ApiRoomEvent } from './types/api';
import EntryScreen from './screens/EntryScreen';
import SetupScreen from './screens/SetupScreen';
import LobbyScreen from './screens/LobbyScreen';
import BubbleFieldScreen from './screens/BubbleFieldScreen';
import CommonGroundScreen from './screens/CommonGroundScreen';
import RecommendationScreen from './screens/RecommendationScreen';
import { buildMyInteractions } from './mappers/interactions';
import { getRoom, getRoomMe } from './api/room';
import { isSessionGoneError, sessionGoneMessage } from './api/errors';
import { normalizeRoomCode, parseInviteCodeFromPath } from './lib/roomCode';

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

// 앱 시작 시점의 세션 결정:
// - /join/:code 초대 링크로 들어오면 코드를 자동 입력한 entry에서 시작한다.
//   (같은 방의 대기실/필드를 이미 복원 중이었다면 그 세션을 우선한다.)
function resolveInitialSession(): { session: SavedSessionState | null; inviteCode: string | null } {
  const saved = readSavedSession();
  const invite =
    typeof window === 'undefined' ? null : parseInviteCodeFromPath(window.location.pathname);

  if (!invite) return { session: saved, inviteCode: null };

  const restoredScreen = getRestoredScreen(saved);
  const savedCode = normalizeRoomCode(saved?.roomCode || saved?.roomCodeInput || '');
  if (saved && (restoredScreen === 'lobby' || restoredScreen === 'field') && savedCode === invite) {
    return { session: saved, inviteCode: null };
  }

  return {
    session: {
      currentScreen: 'entry',
      nickname: saved?.nickname ?? '',
      mode: null,
      roomCodeInput: invite,
      myInterests: [],
      roomCode: '',
      currentUserId: '',
    },
    inviteCode: invite,
  };
}

export default function App() {
  const [initial] = useState(resolveInitialSession);
  const savedSession = initial.session;
  const [inviteCode, setInviteCode] = useState<string | null>(initial.inviteCode);
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => getRestoredScreen(savedSession));
  // 저장된 방(대기실/필드)을 복원하는 경우, 서버에서 유효한지 확인하기 전까지는 화면을 보여주지 않는다.
  const [isRestoring, setIsRestoring] = useState(() => {
    const screen = getRestoredScreen(savedSession);
    return screen === 'lobby' || screen === 'field';
  });
  const [nickname, setNickname] = useState(savedSession?.nickname ?? '');
  const [mode, setMode] = useState<EntryMode | null>(savedSession?.mode ?? null);
  const [roomCodeInput, setRoomCodeInput] = useState(savedSession?.roomCodeInput ?? '');
  const [myInterests, setMyInterests] = useState<Interest[]>(savedSession?.myInterests ?? []);
  const [roomCode, setRoomCodeState] = useState(savedSession?.roomCode ?? '');
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
  // room API가 필요한 화면으로 가려는데 방 코드가 없는 경우를 막기 위해 최신 방 코드를 ref로도 들고 있는다.
  // (setRoomCode 직후 같은 틱에서 navigate가 호출돼도 최신 값을 볼 수 있도록 setter에서 동기 갱신한다.)
  const activeRoomCodeRef = useRef((savedSession?.roomCode || savedSession?.roomCodeInput) ?? '');

  const setRoomCode = useCallback((code: string) => {
    activeRoomCodeRef.current = code;
    setRoomCodeState(code);
  }, []);

  const setRoomCodeInputSynced = useCallback((code: string) => {
    setRoomCodeInput(code);
    activeRoomCodeRef.current = code;
  }, []);

  const navigate = useCallback((screen: Screen) => {
    const needsRoom = screen === 'lobby' || screen === 'field' || screen === 'recommendation';
    if (needsRoom && !activeRoomCodeRef.current.trim()) return;
    setCurrentScreen(screen);
  }, []);

  const resetSessionState = useCallback((notice?: string) => {
    activeRoomCodeRef.current = '';
    setInviteCode(null);
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
  }, [setRoomCode]);

  // 앱 로드 시 저장된 방을 서버에서 검증한다. 방이 없거나(404) 세션이 무효(401/403)면 정리하고 홈으로 보낸다.
  useEffect(() => {
    if (!isRestoring) return;

    const controller = new AbortController();
    const code = activeRoomCodeRef.current;

    (async () => {
      try {
        await getRoom(code, { signal: controller.signal });
        await getRoomMe(code, { signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted) return;
        // 네트워크 오류 등 일시적 문제는 세션을 유지하고 화면 쪽 폴링에 맡긴다.
        if (isSessionGoneError(error)) resetSessionState(sessionGoneMessage(error));
      }
      if (!controller.signal.aborted) setIsRestoring(false);
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 화면 전환 시 스크롤을 맨 위로 되돌린다. (관심사 화면이 중간부터 열리는 문제 방지)
  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [currentScreen]);

  // 초대 링크(/join/:code)는 코드를 상태로 옮긴 뒤 주소를 정리한다.
  useEffect(() => {
    if (initial.inviteCode) window.history.replaceState(null, '', '/');
  }, [initial.inviteCode]);

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

  if (isRestoring) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50 flex items-center justify-center">
        <p className="text-sm text-gray-600" role="status">방 정보를 확인하는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50">
      {currentScreen === 'entry' && (
        <EntryScreen
          nickname={nickname}
          setNickname={setNickname}
          roomCodeInput={roomCodeInput}
          setRoomCodeInput={setRoomCodeInputSynced}
          setMode={setMode}
          onNavigate={navigate}
          notice={sessionNotice}
          onDismissNotice={() => setSessionNotice(null)}
          inviteCode={inviteCode}
        />
      )}

      {currentScreen === 'setup' && (
        <SetupScreen
          nickname={nickname}
          mode={mode}
          roomCodeInput={roomCodeInput}
          roomCode={roomCode}
          interests={myInterests}
          setInterests={setMyInterests}
          setCurrentUserId={setCurrentUserId}
          setRoomCode={setRoomCode}
          onNavigate={navigate}
        />
      )}

      {currentScreen === 'lobby' && (
        <LobbyScreen
          roomCode={roomCode || roomCodeInput}
          currentUserId={currentUserId}
          setCurrentUserId={setCurrentUserId}
          onNavigate={navigate}
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
          onNavigate={navigate}
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
          myName={nickname.trim() || '나'}
          interactions={myInteractions}
          onClose={() => setShowCommonGround(false)}
        />
      )}
    </div>
  );
}
