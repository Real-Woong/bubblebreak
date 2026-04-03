import { useMemo, useState } from 'react';
import { Lock, Plus, X, ChevronRight } from 'lucide-react';
import type { Screen, DeepLevel, Interest } from '../types/bubble';
import BubblePreview from '../components/BubblePreview';

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

// ── Collision-aware stable placement ─────────────────────────────────────────
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
  interests,
  setInterests,
  onNavigate,
}: {
  interests: Interest[];
  setInterests: (interests: Interest[]) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const [activeLevel, setActiveLevel] = useState<DeepLevel>('deep1');
  const [inputValue,  setInputValue]  = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const addInterest = () => {
    if (!inputValue.trim()) return;
    const levelInterests = interests.filter((i) => i.level === activeLevel);
    if (levelInterests.length >= 3) return;
    setInterests([
      ...interests,
      { id: Date.now().toString(), text: inputValue.trim(), level: activeLevel },
    ]);
    setInputValue('');
  };

  const removeInterest = (id: string) => {
    setInterests(interests.filter((i) => i.id !== id));
  };

  const levels = [
    { id: 'deep1' as DeepLevel, label: 'Deep 1', desc: '공개',  color: 'from-purple-400 to-purple-500', example: '게임, 운동, 음악 등' },
    { id: 'deep2' as DeepLevel, label: 'Deep 2', desc: '반공개', color: 'from-pink-400 to-pink-500',   example: '조금 개인적인 취미' },
    { id: 'deep3' as DeepLevel, label: 'Deep 3', desc: '비공개', color: 'from-purple-500 to-pink-600', example: '부끄럽거나 민감한 관심사' },
  ];

  const currentInterests = interests.filter((i) => i.level === activeLevel);
  const currentLevel      = levels.find((l) => l.id === activeLevel)!;
  const isFull            = currentInterests.length >= 3;

  // Positions are recomputed only when `interests` reference changes.
  // Because buildPositions is pure + seeded, the output is stable.
  const positions = useMemo(() => buildPositions(interests), [interests]);

  return (
    <div className="min-h-screen pb-8">
      <div className="max-w-[375px] mx-auto">

        <div className="px-5 pt-8 pb-4">
          {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">내 관심사 설정하기</h2>
          <p className="text-sm text-gray-600">각 단계별로 최대 3개까지 입력할 수 있어요</p>
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
            onClick={() => onNavigate('lobby')}
            disabled={interests.length === 0}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-full font-semibold shadow-lg shadow-purple-200/50 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            버블 만들기
            <ChevronRight className="w-5 h-5" />
          </button>
          {interests.length === 0 && (
            <p className="text-xs text-center text-gray-500 mt-3">
              최소 1개 이상의 관심사를 추가해주세요
            </p>
          )}
        </div>

      </div>
    </div>
  );
}