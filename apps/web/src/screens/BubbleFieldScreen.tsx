import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Users, Sparkles, CheckCircle, Lock } from 'lucide-react';
import type { Interest, Participant } from '../types/bubble';
import BubbleField from '../components/BubbleField';

// ============================================================
// 타입 정의
// ============================================================
type FieldBubble = {
  id: string;
  interest: Interest;
  participantId: string;
  participantName: string;
  participantColor: string;
  worldX: number;
  worldY: number;
  size: number;
  isMine: boolean;
};

const USER_MAIN_GRADIENTS = {
  user1: {
    deep1: 'from-pink-400 to-pink-500',
    deep2: 'from-fuchsia-300 to-pink-400',
    deep3: 'from-pink-500 to-rose-500'
  },
  user2: {
    deep1: 'from-violet-400 to-purple-500',
    deep2: 'from-purple-300 to-violet-400',
    deep3: 'from-violet-500 to-fuchsia-500'
  },
  user3: {
    deep1: 'from-sky-400 to-cyan-500',
    deep2: 'from-cyan-300 to-sky-400',
    deep3: 'from-sky-500 to-blue-500'
  },
  user4: {
    deep1: 'from-lime-400 to-green-500',
    deep2: 'from-green-300 to-lime-400',
    deep3: 'from-lime-500 to-emerald-500'
  },
  user5: {
    deep1: 'from-yellow-300 to-amber-400',
    deep2: 'from-amber-200 to-yellow-300',
    deep3: 'from-yellow-400 to-orange-400'
  },
  user6: {
    deep1: 'from-emerald-300 to-teal-400',
    deep2: 'from-teal-200 to-emerald-300',
    deep3: 'from-teal-400 to-cyan-400'
  }
} as const;

function getUserSlot(participantId: string) {
  if (participantId === 'me' || participantId === 'user-1' || participantId === 'user1') {
    return 'user1';
  }

  const numericMatch = participantId.match(/\d+/);
  const numericId = numericMatch ? Number(numericMatch[0]) : 1;

  const normalized = Math.min(Math.max(numericId, 1), 6);
  return `user${normalized}` as keyof typeof USER_MAIN_GRADIENTS;
}

function getBubbleGradient(participantId: string, level: Interest['level']) {
  const userSlot = getUserSlot(participantId);
  return USER_MAIN_GRADIENTS[userSlot][level];
}

function getBubbleShadowByParticipant(participantId: string) {
  const userSlot = getUserSlot(participantId);

  switch (userSlot) {
    case 'user1':
      return '0 14px 30px rgba(244, 114, 182, 0.22), 0 6px 14px rgba(244, 114, 182, 0.14)';
    case 'user2':
      return '0 14px 30px rgba(168, 85, 247, 0.22), 0 6px 14px rgba(168, 85, 247, 0.14)';
    case 'user3':
      return '0 14px 30px rgba(56, 189, 248, 0.22), 0 6px 14px rgba(56, 189, 248, 0.14)';
    case 'user4':
      return '0 14px 30px rgba(163, 230, 53, 0.22), 0 6px 14px rgba(163, 230, 53, 0.14)';
    case 'user5':
      return '0 14px 30px rgba(250, 204, 21, 0.22), 0 6px 14px rgba(250, 204, 21, 0.14)';
    case 'user6':
      return '0 14px 30px rgba(45, 212, 191, 0.22), 0 6px 14px rgba(45, 212, 191, 0.14)';
    default:
      return '0 14px 30px rgba(168, 85, 247, 0.14), 0 6px 14px rgba(168, 85, 247, 0.10)';
  }
}

// ============================================================
// 레이아웃 / 버블 배치 상수
// ============================================================
const HEADER_HEIGHT = 72;
const CLUSTER_SPREAD_X = 260;
const CLUSTER_SPREAD_Y = 190;
const MIN_BUBBLE_SIZE = 104;
const MAX_BUBBLE_SIZE = 156;
const MIN_BUBBLE_GAP = 28;
const LEVEL_RADIUS: Record<Interest['level'], number> = {
  deep1: 120,
  deep2: 220,
  deep3: 320
};

// ============================================================
// 레이아웃 헬퍼 함수
// ============================================================
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}


function bubblesOverlap(
  a: { x: number; y: number; size: number },
  b: { x: number; y: number; size: number }
) {
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  return distance < a.size / 2 + b.size / 2 + MIN_BUBBLE_GAP;
}

function findNonOverlappingPosition(
  center: { x: number; y: number },
  size: number,
  preferredRadius: number,
  placedBubbles: Array<{ x: number; y: number; size: number }>,
  seedBase: number
) {
  for (let ring = 0; ring < 16; ring += 1) {
    const radius = preferredRadius + ring * 34;
    const steps = 18 + ring * 6;

    for (let step = 0; step < steps; step += 1) {
      const randomOffset = seededRandom(seedBase + ring * 101 + step * 17) * 0.18;
      const angle = ((step / steps) * Math.PI * 2) + randomOffset;
      const candidate = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
        size
      };

      if (placedBubbles.every((existingBubble) => !bubblesOverlap(existingBubble, candidate))) {
        return candidate;
      }
    }
  }

  return null;
}

function buildWorldLayout(participants: Participant[], currentUserId: string) {
  const participantCount = Math.max(participants.length, 1);
  const clusters: Record<string, { x: number; y: number }> = {};

  participants.forEach((participant, index) => {
    const angle = (index / participantCount) * Math.PI * 2 - Math.PI / 2;
    const ellipseRadiusX = participantCount <= 2 ? 180 : CLUSTER_SPREAD_X;
    const ellipseRadiusY = participantCount <= 2 ? 135 : CLUSTER_SPREAD_Y;

    clusters[participant.id] = {
      x: Math.cos(angle) * ellipseRadiusX,
      y: Math.sin(angle) * ellipseRadiusY
    };
  });

  const bubbles: FieldBubble[] = [];
  const placedBubbles: Array<{ x: number; y: number; size: number }> = [];

  participants.forEach((participant, participantIndex) => {
    const center = clusters[participant.id];

    participant.interests.forEach((interest, idx) => {
      const size = Math.max(MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE - idx * 8);
      const preferredRadius = LEVEL_RADIUS[interest.level];
      const seedBase =
        participantIndex * 1000 +
        idx * 100 +
        participant.name.length * 17 +
        participant.id.length * 29;

      let placedBubble = findNonOverlappingPosition(
        center,
        size,
        preferredRadius,
        placedBubbles,
        seedBase
      );

      if (!placedBubble) {
        placedBubble = findNonOverlappingPosition(
          center,
          size,
          preferredRadius + 120,
          placedBubbles,
          seedBase + 999
        );
      }

      if (!placedBubble) {
        placedBubble = {
          x: center.x + participantIndex * 120 + idx * 52,
          y: center.y + participantIndex * 80 + idx * 64,
          size
        };
      }

      placedBubbles.push(placedBubble);
        bubbles.push({
          id: `${participant.id}-${interest.id}`,
          interest,
          participantId: participant.id,
          participantName: participant.name,
          participantColor: participant.color,
          worldX: placedBubble.x,
          worldY: placedBubble.y,
          size: placedBubble.size,
          isMine: participant.id === currentUserId
        });
    });
  });

  return bubbles;
}

// ============================================================
// 시각 스타일 헬퍼 함수
// ============================================================
function getBubbleMotionValues(bubble: FieldBubble, index: number) {
  const floatDuration = 6.8 + seededRandom(index * 37 + bubble.participantId.length * 19) * 2.6;
  const swayDuration = 5.4 + seededRandom(index * 41 + bubble.participantName.length * 11) * 1.8;
  const shimmerDuration = 6.2 + seededRandom(index * 83 + bubble.size * 7) * 2.2;
  const floatX = Math.round(8 + seededRandom(index * 71 + bubble.size) * 10);
  const floatY = Math.round(12 + seededRandom(index * 89 + bubble.size) * 14);
  const rotateDeg = (1.8 + seededRandom(index * 61 + bubble.size * 3) * 2.4).toFixed(2);
  const delay = -(seededRandom(index * 29 + bubble.interest.id.length * 17) * 4.8);

  return {
    floatDuration,
    swayDuration,
    shimmerDuration,
    floatX,
    floatY,
    rotateDeg,
    delay
  };
}

// ============================================================
// 화면 컴포넌트
// ============================================================
export default function BubbleFieldScreen({
  participants,
  currentUserId,
  onShowCommonGround,
  selectedBubble,
  setSelectedBubble
}: {
  participants: Participant[];
  currentUserId: string;
  onShowCommonGround: () => void;
  selectedBubble: Interest | null;
  setSelectedBubble: (bubble: Interest | null) => void;
}) {
  // --------------------------------------------
  // UI 상태
  // --------------------------------------------
  const [showNotification, setShowNotification] = useState(false);
  const [showPopConfirm, setShowPopConfirm] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight - HEADER_HEIGHT });

  // --------------------------------------------
  // 제스처 / 드래그 ref
  // --------------------------------------------
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const lastCameraLayoutKeyRef = useRef('');

  // --------------------------------------------
  // 제스처 헬퍼 함수
  // --------------------------------------------
  const resetDragState = () => {
    window.setTimeout(() => {
      dragMovedRef.current = false;
      activePointerIdRef.current = null;
      setIsDragging(false);
    }, 0);
  };

  // --------------------------------------------
  // 외부에서 주입받는 데이터
  // participants, currentUserId
  // --------------------------------------------

  // participants / currentUserId 기반으로만 버블 레이아웃을 계산
  // --------------------------------------------
  // 파생 레이아웃 데이터
  // --------------------------------------------
  const fieldBubbles = useMemo(() => {
    return buildWorldLayout(participants, currentUserId);
  }, [participants, currentUserId]);

  const getInitialCamera = useCallback((width: number, height: number) => {
    if (fieldBubbles.length === 0) {
      return { x: 0, y: 0 };
    }

    const minX = Math.min(...fieldBubbles.map((bubble) => bubble.worldX - bubble.size / 2));
    const maxX = Math.max(...fieldBubbles.map((bubble) => bubble.worldX + bubble.size / 2));
    const minY = Math.min(...fieldBubbles.map((bubble) => bubble.worldY - bubble.size / 2));
    const maxY = Math.max(...fieldBubbles.map((bubble) => bubble.worldY + bubble.size / 2));

    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
  }, [fieldBubbles]);

  // --------------------------------------------
  // 뷰포트 / 초기 카메라 설정
  // --------------------------------------------
  useLayoutEffect(() => {
    const updateViewport = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight - HEADER_HEIGHT });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    if (isDragging) return;

    const layoutKey = [
      viewportSize.width,
      viewportSize.height,
      ...fieldBubbles.map(
        (bubble) => `${bubble.id}:${bubble.worldX}:${bubble.worldY}:${bubble.size}`
      )
    ].join('|');

    if (lastCameraLayoutKeyRef.current === layoutKey) {
      return;
    }

    lastCameraLayoutKeyRef.current = layoutKey;
    setCamera(getInitialCamera(viewportSize.width, viewportSize.height));
  }, [fieldBubbles, getInitialCamera, viewportSize, isDragging]);

  // --------------------------------------------
  // 포인터 / 드래그 핸들러
  // --------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const target = e.target as HTMLElement;
    if (target.closest('[data-bubble-interactive="true"]')) {
      return;
    }

    e.preventDefault();
    activePointerIdRef.current = e.pointerId;
    dragMovedRef.current = false;
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    panStartXRef.current = camera.x;
    panStartYRef.current = camera.y;

    if (typeof container.setPointerCapture === 'function') {
      container.setPointerCapture(e.pointerId);
    }
  };


  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    if (e.cancelable) {
      e.preventDefault();
    }

    const deltaX = e.clientX - dragStartXRef.current;
    const deltaY = e.clientY - dragStartYRef.current;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragMovedRef.current = true;
    }

    setCamera({
      x: panStartXRef.current - deltaX,
      y: panStartYRef.current - deltaY
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (activePointerIdRef.current === e.pointerId) {
      try {
        container?.releasePointerCapture(e.pointerId);
      } catch {
        // no-op
      }
    }
    resetDragState();
  };

  // --------------------------------------------
  // 버블 상호작용
  // --------------------------------------------
  const handleBubbleTap = (bubble: FieldBubble) => {
    if (dragMovedRef.current) return;
    if (bubble.isMine) return;
    setSelectedParticipant(
      participants.find((participant) => participant.id === bubble.participantId) ?? null
    );
    setSelectedBubble(bubble.interest);
    setShowPopConfirm(true);
  };

  const handlePop = () => {
    setShowPopConfirm(false);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
      setSelectedBubble(null);
      setSelectedParticipant(null);
    }, 3000);
  };

  // --------------------------------------------
  // 렌더링
  // --------------------------------------------
  return (
    <div
      className="h-screen w-screen overflow-hidden fixed inset-0 bg-gradient-to-b from-purple-50/30 to-white select-none"
      style={{
        overscrollBehavior: 'none'
      }}
    >
      <style>{`
        @keyframes bubbleDrift {
          0% {
            transform: translate3d(0px, 0px, 0);
          }
          25% {
            transform: translate3d(var(--float-x), calc(var(--float-y) * -0.55), 0);
          }
          50% {
            transform: translate3d(calc(var(--float-x) * -0.35), calc(var(--float-y) * -1), 0);
          }
          75% {
            transform: translate3d(calc(var(--float-x) * -1), calc(var(--float-y) * -0.2), 0);
          }
          100% {
            transform: translate3d(0px, 0px, 0);
          }
        }

        @keyframes bubbleSway {
          0% {
            transform: rotate(0deg) scale(1, 1);
          }
          25% {
            transform: rotate(calc(var(--rotate-deg) * -1deg)) scale(1.016, 0.992);
          }
          50% {
            transform: rotate(calc(var(--rotate-deg) * 0.6deg)) scale(1.026, 0.986);
          }
          75% {
            transform: rotate(calc(var(--rotate-deg) * -0.5deg)) scale(1.012, 0.996);
          }
          100% {
            transform: rotate(0deg) scale(1, 1);
          }
        }

        @keyframes bubbleInnerDrift {
          0% {
            transform: translate3d(0px, 0px, 0) scale(1);
            opacity: 0.86;
          }
          50% {
            transform: translate3d(5px, -7px, 0) scale(1.05);
            opacity: 1;
          }
          100% {
            transform: translate3d(0px, 0px, 0) scale(1);
            opacity: 0.86;
          }
        }

        @keyframes bubbleGlossSweep {
          0% {
            transform: translate3d(0px, 0px, 0) rotate(-18deg);
            opacity: 0.24;
          }
          50% {
            transform: translate3d(7px, -9px, 0) rotate(-13deg);
            opacity: 0.42;
          }
          100% {
            transform: translate3d(0px, 0px, 0) rotate(-18deg);
            opacity: 0.24;
          }
        }
      `}</style>
      {/* 상단 바 */}
      <div
        className="fixed top-0 left-0 right-0 z-40 bg-white/92 backdrop-blur-md border-b border-purple-100"
        style={{
          height: `${HEADER_HEIGHT}px`,
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <div className="relative flex items-center h-full px-5 w-full">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">버블 필드</h3>
            <p className="text-xs text-gray-500">버블을 눌러 관심사를 확인하세요</p>
          </div>

          <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-right">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-600">{participants.length}</span>
          </div>
        </div>
      </div>

      {/* 버블 필드 / 카메라 뷰포트 */}
      <div
        style={{
          marginTop: HEADER_HEIGHT,
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          // background: 'yellow',
          position: 'relative'
        }}
      >
        <div className="relative h-full w-full overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="absolute inset-0 z-10 select-none focus:outline-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              overflow: 'hidden',
              touchAction: 'none',
              cursor: isDragging ? 'grabbing' : 'grab',
              outline: 'none',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              WebkitUserSelect: 'none',
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div
              className="relative"
              style={{ position: 'relative', width: '100%', height: '100%' }}
            >
              {fieldBubbles.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                  <div className="rounded-3xl bg-white/80 backdrop-blur-sm px-6 py-5 shadow-sm border border-purple-100">
                    <p className="text-sm font-medium text-gray-700">아직 표시할 버블 데이터가 없어요</p>
                    <p className="mt-1 text-xs text-gray-500">로비에서 참가자와 관심사를 먼저 준비해 주세요</p>
                  </div>
                </div>
              )}
              {fieldBubbles.map((bubble, index) => {
                const isSelected = selectedBubble?.id === bubble.interest.id;
                const motion = getBubbleMotionValues(bubble, index);

                return (
                  <div
                    key={bubble.id}
                    className="absolute"
                    style={{
                      left: `${bubble.worldX - camera.x + viewportSize.width / 2 - bubble.size / 2}px`,
                      top: `${bubble.worldY - camera.y + viewportSize.height / 2 - bubble.size / 2}px`,
                      width: `${bubble.size}px`,
                      height: `${bubble.size}px`,
                      willChange: 'transform',
                      transform: 'translate3d(0,0,0)',
                      animation: `bubbleDrift ${motion.floatDuration}s ease-in-out ${motion.delay}s infinite`,
                      ['--float-x' as string]: `${motion.floatX}px`,
                      ['--float-y' as string]: `${motion.floatY}px`,
                      ['--rotate-deg' as string]: motion.rotateDeg
                    }}
                  >
                    <div
                      data-bubble-interactive="true"
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        handleBubbleTap(bubble);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleBubbleTap(bubble);
                        }
                      }}
                      className={`${bubble.isMine ? 'cursor-default' : 'cursor-pointer'} ${
                        isSelected ? 'ring-4 ring-white/90 rounded-full' : ''
                      } select-none focus:outline-none focus:ring-0`}
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        borderRadius: '9999px',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        outline: 'none',
                        touchAction: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        pointerEvents: 'auto',
                        willChange: 'transform',
                        animation: `bubbleSway ${motion.swayDuration}s ease-in-out ${motion.delay}s infinite`
                      }}
                    >
                      <BubbleField
                        interest={bubble.interest}
                        participantId={bubble.participantId}
                        participantColor={bubble.participantColor}
                        sizePx={bubble.size}
                        isMine={bubble.isMine}
                        isSelected={isSelected}
                        onTap={() => handleBubbleTap(bubble)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 플로팅 액션 버튼 */}
      <button
        onClick={onShowCommonGround}
        className="fixed bottom-6 right-5 w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-xl shadow-purple-300/50 flex items-center justify-center active:scale-95 transition-transform z-50"
        style={{ touchAction: 'manipulation' }}
      >
        <Sparkles className="w-6 h-6 text-white" />
      </button>

      {/* 알림 토스트 */}
      {showNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
          <div className="bg-purple-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {selectedParticipant && selectedBubble
                ? selectedBubble.level === 'deep3'
                  ? `${selectedParticipant.name}에게 확인 요청을 보냈어요!`
                  : `${selectedParticipant.name}의 관심사를 확인했어요!`
                : '관심사를 확인했어요!'}
            </span>
          </div>
        </div>
      )}

      {/* 버블 액션 바텀시트 */}
      {showPopConfirm && selectedBubble && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-end"
          onClick={() => setShowPopConfirm(false)}
        >
          <div
            className="bg-white rounded-t-3xl w-full p-6 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <h3 className="font-bold text-gray-900 text-lg mb-2">버블을 터뜨릴까요?</h3>
              <p className="text-sm text-gray-600">
                {selectedBubble.level === 'deep3'
                  ? '상대방에게 요청을 보내요'
                  : '관심사가 상대방에게 공개돼요'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2">
                {selectedBubble.level === 'deep3' && (
                  <Lock className="w-5 h-5 text-purple-500" />
                )}
                <span className="font-semibold text-gray-900">
                  {selectedBubble.level === 'deep3' ? '🔒 비공개 관심사' : selectedBubble.text}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPopConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-full font-semibold active:scale-95 transition-transform"
              >
                취소
              </button>
              <button
                onClick={handlePop}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3.5 rounded-full font-semibold active:scale-95 transition-transform"
              >
                {selectedBubble.level === 'deep3' ? '요청 보내기' : '터뜨리기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}