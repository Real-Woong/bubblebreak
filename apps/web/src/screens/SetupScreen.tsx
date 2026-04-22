import { Dispatch, SetStateAction, useMemo, useState } from 'react';
import { Lock, Plus, X, ChevronRight } from 'lucide-react';
import type { Screen, DeepLevel, Interest } from '../types/bubble';
import BubblePreview from '../components/BubblePreview';
import { createRoom, joinRoom } from '../api/room';

// EntryScreen 에서 선택한 진입 흐름
// create = 방 만들기, join = 방 참여하기
// 아직은 SetupScreen 내부에서만 쓰는 로컬 타입으로 둔다.
type EntryMode = 'create' | 'join';

// SetupScreen 이 부모(App.tsx)에게서 받아야 하는 props 정의
// 지금 단계에서는 아직 API를 붙이지 않았기 때문에,
// 부모가 들고 있는 draft 상태를 읽어서 화면만 구성하고
// 완료 시 관심사만 저장한 뒤 lobby 로 이동한다.
type SetupScreenProps = {
  // EntryScreen 에서 입력한 닉네임
  nickname: string;

  // EntryScreen 에서 선택한 모드
  mode: EntryMode | null;

  // join 흐름일 때 입력한 방 코드
  roomCodeInput: string;

  // 현재까지 추가된 관심사 목록
  interests: Interest[];

  // App.tsx 에 있는 관심사 state setter 그대로 받음
  setInterests: Dispatch<SetStateAction<Interest[]>>;

  // create/join 성공 후 받은 실제 userId 저장
  setCurrentUserId: Dispatch<SetStateAction<string>>;

  // create/join 성공 후 받은 실제 roomCode 저장
  setRoomCode: Dispatch<SetStateAction<string>>;

  // App.tsx 의 화면 전환 setter 그대로 받음
  onNavigate: Dispatch<SetStateAction<Screen>>;
};

// ── Original purple/pink palette, one shade per depth level ──────────────────
const LEVEL_GRADIENTS: Record<DeepLevel, string> = {
  deep1: 'linear-gradient(135deg, rgb(192 132 252), rgb(244 114 182))', // purple → pink
  deep2: 'linear-gradient(135deg, rgb(216 180 254), rgb(249 168 212))', // lighter purple → pink
  deep3: 'linear-gradient(135deg, rgb(139 92 246),  rgb(192 132 252))', // deep violet → purple
};

// ── Layout constants ──────────────────────────────────────────────────────────
const PREVIEW_H    = 190;  // preview container height in px
const CONTAINER_W  = 335;  // usable width (375 − px-5*2)
const MIN_GAP      = 8;    // minimum gap between bubble edges in px
const PREVIEW_SIZE_RANGE: Record<DeepLevel, [number, number]> = {
  deep1: [52, 68],
  deep2: [44, 60],
  deep3: [36, 52]
};

// ── Collision-aware  ㅇstable placement ─────────────────────────────────────────
// Uses a seeded PRNG per bubble so positions are deterministic across re-renders.
// Tries up to MAX_ATTEMPTS candidate positions per bubble; picks the first one
// that doesn't overlap any already-placed bubble.

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function getPreviewBubbleSize(interest: Interest): number {
  let idHash = 0;
  for (let i = 0; i < interest.id.length; i++) {
    idHash = (Math.imul(31, idHash) + interest.id.charCodeAt(i)) | 0;
  }

  const rand = seededRand(idHash ^ 0x9e3779b9);
  const [minSize, maxSize] = PREVIEW_SIZE_RANGE[interest.level];
  return Math.round(minSize + rand() * (maxSize - minSize));
}

function buildPositions(interests: Interest[]): Array<{ x: number; y: number; size: number }> {
  const placed: Array<{ x: number; y: number; size: number }> = [];

  const bandY: Record<DeepLevel, [number, number]> = {
    deep1: [0, PREVIEW_H * 0.40],
    deep2: [PREVIEW_H * 0.30, PREVIEW_H * 0.70],
    deep3: [PREVIEW_H * 0.60, PREVIEW_H]
  };

  for (const interest of interests) {
    const size = getPreviewBubbleSize(interest);
    const radius = size / 2;
    const minX = radius;
    const maxX = CONTAINER_W - radius;
    const minY = radius;
    const maxY = PREVIEW_H - radius;

    let idHash = 0;
    for (let i = 0; i < interest.id.length; i++) {
      idHash = (Math.imul(31, idHash) + interest.id.charCodeAt(i)) | 0;
    }
    const rand = seededRand(idHash);

    const [bMin, bMax] = bandY[interest.level];
    const clampedBMin = Math.max(minY, bMin + radius * 0.2);
    const clampedBMax = Math.min(maxY, bMax - radius * 0.2);

    const MAX_ATTEMPTS = 120;
    let best: { x: number; y: number; size: number } | null = null;
    let bestOverlap = Infinity;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const cx = minX + rand() * Math.max(1, maxX - minX);
      const cy = attempt < 80
        ? clampedBMin + rand() * Math.max(1, clampedBMax - clampedBMin)
        : minY + rand() * Math.max(1, maxY - minY);

      let worstOverlap = 0;
      for (const p of placed) {
        const dist = Math.hypot(cx - p.x, cy - p.y);
        const overlap = radius + p.size / 2 + MIN_GAP - dist;
        if (overlap > worstOverlap) worstOverlap = overlap;
      }

      if (worstOverlap <= 0) {
        best = { x: cx, y: cy, size };
        break;
      }
      if (worstOverlap < bestOverlap) {
        bestOverlap = worstOverlap;
        best = { x: cx, y: cy, size };
      }
    }

    placed.push(best!);
  }

  return placed;
}

// ── SetupScreen ───────────────────────────────────────────────────────────────
export default function SetupScreen({
  nickname,
  mode,
  roomCodeInput,
  interests,
  setInterests,
  setCurrentUserId,
  setRoomCode,
  onNavigate,
}: SetupScreenProps) {
  // 현재 어떤 깊이 탭을 보고 있는지
  const [activeLevel, setActiveLevel] = useState<DeepLevel>('deep1');

  // 현재 입력창에 쓰고 있는 문자열
  const [inputValue, setInputValue] = useState('');

  // 한글 조합 입력(IME) 중 Enter 오작동 방지용 상태
  const [isComposing, setIsComposing] = useState(false);

  // API 요청 중 로딩 상태
  const [isSubmitting, setIsSubmitting] = useState(false);

  // create/join 실패 시 보여줄 에러 메시지
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 현재 선택한 depth(activeLevel)에 관심사를 추가하는 함수
  // 규칙:
  // - 공백만 있는 문자열은 추가하지 않음
  // - 각 depth 는 최대 3개까지만 허용
  // - text 는 trim 해서 저장
  // - 아직 기존 BubblePreview 로직이 interest.id 를 사용하므로 id 는 유지
  const addInterest = () => {
    const trimmed = inputValue.trim();

    // 빈 문자열이면 추가하지 않음
    if (!trimmed) return;

    // 현재 탭(depth)에 이미 몇 개 들어갔는지 계산
    const levelInterests = interests.filter((i) => i.level === activeLevel);

    // depth 별 최대 3개 제한
    if (levelInterests.length >= 3) return;

    // 부모(App.tsx)가 들고 있는 interests 상태에 새 항목 추가
    setInterests((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text: trimmed,
        level: activeLevel,
      },
    ]);

    // 입력 완료 후 입력창 비우기
    setInputValue('');
  };

  // 추가된 관심사를 삭제하는 함수
  // 현재 구조에서는 id 기준으로 제거한다.
  const removeInterest = (id: string) => {
    setInterests((prev) => prev.filter((i) => i.id !== id));
  };

  const levels = [
    { id: 'deep1' as DeepLevel, label: 'Deep 1', desc: '공개',  color: 'from-purple-400 to-purple-500', example: '게임, 운동, 음악 등' },
    { id: 'deep2' as DeepLevel, label: 'Deep 2', desc: '반공개', color: 'from-pink-400 to-pink-500',   example: '조금 개인적인 취미' },
    { id: 'deep3' as DeepLevel, label: 'Deep 3', desc: '비공개', color: 'from-purple-500 to-pink-600', example: '부끄럽거나 민감한 관심사' },
  ];

  // 현재 모드에 따라 상단 문구와 CTA 문구를 조금 다르게 보여준다.
  // 아직 create/join API 는 붙이지 않았지만,
  // 화면 단계에서부터 흐름을 구분해두면 다음 단계에서 확장하기 쉽다.
  const modeLabel = mode === 'join' ? '방 참여' : '방 만들기';
  const modeDescription =
    mode === 'join'
      ? '관심사를 입력한 뒤 해당 방에 참여해요'
      : '관심사를 입력한 뒤 새로운 방을 만들어요';

  const submitLabel = mode === 'join' ? '입력 완료하고 입장하기' : '방 만들고 입장하기';

  // join 흐름일 때만 보여줄 방 코드 표시값
  const normalizedRoomCode = roomCodeInput.trim().toUpperCase();

  const currentInterests = interests.filter((i) => i.level === activeLevel);
  const currentLevel      = levels.find((l) => l.id === activeLevel)!;
  const isFull            = currentInterests.length >= 3;

  // 미리보기 버블 위치는 interests 배열이 바뀔 때만 다시 계산한다.
  // buildPositions 는 seeded random 기반이라 같은 interest 목록이면
  // 렌더링이 다시 되어도 배치가 크게 흔들리지 않는다.
  const positions = useMemo(() => buildPositions(interests), [interests]);

  // 완료 버튼 클릭 시 실행되는 함수
  // create / join 실제 API 호출을 여기서 수행한다.
  const handleSubmit = async () => {
    // 방 참여인데 room code 가 비어 있으면 막기
    if (mode === 'join' && !normalizedRoomCode) return;

    // 관심사가 하나도 없으면 진행 불가
    if (interests.length === 0) return;
    if (!mode) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const apiInterests = interests.map((interest) => ({
        text: interest.text,
        level: interest.level,
      }));

      if (mode === 'create') {
        const response = await createRoom({
          nickname: nickname.trim(),
          interests: apiInterests,
        });

        setCurrentUserId(response.userId);
        setRoomCode(response.roomCode);
      } else {
        const response = await joinRoom(normalizedRoomCode, {
          nickname: nickname.trim(),
          interests: apiInterests,
        });

        setCurrentUserId(response.userId);
        setRoomCode(response.roomCode);
      }

      onNavigate('lobby');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '입장 처리 중 오류가 발생했어요');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-8">
      <div className="max-w-[375px] mx-auto">

        <div className="px-5 pt-8 pb-4">
          {/* Header */}
          <div className="text-center mb-6">
            {/* 어떤 플로우(create / join)인지 먼저 보여주면 사용자가 지금 뭘 하고 있는지 덜 헷갈린다. */}
            <p className="text-xs font-semibold text-purple-500 mb-2">{modeLabel} 흐름</p>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">내 관심사 설정하기</h2>
            <p className="text-sm text-gray-600">각 단계별로 최대 3개까지 입력할 수 있어요</p>
          </div>

          {/* 현재 draft 요약 카드
              - 닉네임
              - 현재 모드
              - join 인 경우 방 코드
              지금은 아직 로그인/회원가입이 없기 때문에,
              사용자가 입력한 임시 세션 정보가 맞는지 한번 보여주는 역할을 한다. */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-purple-100/50">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-gray-500">닉네임</span>
                <span className="text-sm font-semibold text-gray-900">{nickname.trim() || '미입력'}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-gray-500">진입 방식</span>
                <span className="text-sm font-semibold text-gray-900">{modeLabel}</span>
              </div>

              {mode === 'join' && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-gray-500">방 코드</span>
                  <span className="text-sm font-semibold text-gray-900 tracking-widest">
                    {normalizedRoomCode || '미입력'}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-3 text-center">{modeDescription}</p>
          </div>
        </div>

        {/* Level tabs */}
        <div className="pb-2">
          <div className="flex gap-3">
          {levels.map((level) => (
            <button
              key={level.id}
              onClick={() => setActiveLevel(level.id)}
              className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all shadow-sm ${
                activeLevel === level.id
                  ? `bg-gradient-to-r ${level.color} text-white shadow-md`
                  : 'bg-white/70 text-gray-600 border border-purple-100/70'
              }`}
            >
              <div>{level.label}</div>
              <div className="text-xs opacity-80">{level.desc}</div>
            </button>
          ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pt-6">

          {/* Level info */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-purple-100/50">
            <div className="flex items-start gap-3">
              {activeLevel === 'deep3' && <Lock className="w-5 h-5 text-purple-500 mt-0.5" />}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">
                  {currentLevel.label} - {currentLevel.desc}
                </h3>
                <p className="text-xs text-gray-600">예시: {currentLevel.example}</p>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const native = (e as any).nativeEvent;
                  if (isComposing || native?.isComposing) return;
                  e.preventDefault();
                  addInterest();
                }}
                placeholder={isFull ? `${currentLevel.label} 최대 3개 입력됨` : '관심사를 입력하세요'}
                maxLength={20}
                disabled={isFull}
                className="flex-1 bg-white/80 backdrop-blur-sm border-2 border-purple-200 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-purple-400 disabled:opacity-50"
              />
              <button
                onClick={addInterest}
                disabled={!inputValue.trim() || isFull}
                className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 px-2">{currentInterests.length}/3</p>
          </div>

          {/* Interest chips */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">추가된 관심사</h4>
            {currentInterests.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">아직 추가된 관심사가 없어요</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentInterests.map((interest) => (
                  <div
                    key={interest.id}
                    className={`bg-gradient-to-r ${currentLevel.color} text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm`}
                  >
                    {activeLevel === 'deep3' && <Lock className="w-3.5 h-3.5" />}
                    <span>{interest.text}</span>
                    <button
                      onClick={() => removeInterest(interest.id)}
                      className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Bubble preview ────────────────────────────────────────────── */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3 px-1">
              <h4 className="text-sm font-semibold text-gray-700">버블 미리보기</h4>
              <p className="text-xs text-gray-400">BubbleField 축소 버전이에요</p>
            </div>

            <div
              style={{
                position: 'relative',
                width: '100%',
                height: PREVIEW_H,
                overflow: 'hidden',
              }}
            >
              {interests.length === 0 ? (
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgb(216 180 254 / 0.5), rgb(249 168 212 / 0.5))',
                  }} />
                  <p style={{ fontSize: 13, color: '#9ca3af' }}>관심사를 추가하면 버블이 떠요</p>
                </div>
              ) : (
                interests.map((interest, idx) => {
                  const pos = positions[idx];
                  return (
                    <div
                      key={interest.id}
                      style={{
                        position: 'absolute',
                        left: pos.x - pos.size / 2,
                        top: pos.y - pos.size / 2,
                        width: pos.size,
                        height: pos.size,
                      }}
                    >
                      <BubblePreview interest={interest} index={idx} size={pos.size} showLock={false} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {/* ── end preview ───────────────────────────────────────────────── */}

        </div>

        {/* CTA */}
        <div className="px-5 mt-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || interests.length === 0 || (mode === 'join' && !normalizedRoomCode)}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-full font-semibold shadow-lg shadow-purple-200/50 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? '처리 중...' : submitLabel}
            <ChevronRight className="w-5 h-5" />
          </button>

          {interests.length === 0 && (
            <p className="text-xs text-center text-gray-500 mt-3">
              최소 1개 이상의 관심사를 추가해주세요
            </p>
          )}

          {mode === 'join' && !normalizedRoomCode && (
            <p className="text-xs text-center text-gray-500 mt-2">
              방 참여 시에는 방 코드가 필요해요
            </p>
          )}

          {submitError && (
            <p className="text-xs text-center text-red-500 mt-2">
              {submitError}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
