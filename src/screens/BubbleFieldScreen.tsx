import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Users, Sparkles, CheckCircle, Lock } from 'lucide-react';
import type { Interest, Participant } from '../types/bubble';

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

const HEADER_HEIGHT = 72;
const WORLD_SPREAD = 300; // reduced so bubbles are visible on initial load
const MIN_BUBBLE_SIZE = 104;
const MAX_BUBBLE_SIZE = 156;


function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildWorldLayout(participants: Participant[]) {
  const clusters: Record<string, { x: number; y: number }> = {};

  participants.forEach((p, i) => {
    const angle = (i / participants.length) * Math.PI * 2;
    clusters[p.id] = {
      x: Math.cos(angle) * WORLD_SPREAD,
      y: Math.sin(angle) * WORLD_SPREAD
    };
  });

  const bubbles: FieldBubble[] = [];

  participants.forEach((participant) => {
    const center = clusters[participant.id];

    participant.interests.forEach((interest, idx) => {
      const radius = interest.level === 'deep1' ? 120 : interest.level === 'deep2' ? 200 : 280;
      const angle = seededRandom(idx * 91) * Math.PI * 2;

      bubbles.push({
        id: `${participant.id}-${interest.id}`,
        interest,
        participantId: participant.id,
        participantName: participant.name,
        participantColor: participant.color,
        worldX: center.x + Math.cos(angle) * radius,
        worldY: center.y + Math.sin(angle) * radius,
        size: Math.max(MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE - idx * 8),
        isMine: participant.id === 'me'
      });
    });
  });

  return bubbles;
}

export default function BubbleFieldScreen({
  myInterests,
  onShowCommonGround,
  selectedBubble,
  setSelectedBubble
}: {
  myInterests: Interest[];
  onShowCommonGround: () => void;
  selectedBubble: Interest | null;
  setSelectedBubble: (bubble: Interest | null) => void;
}) {
  const [showNotification, setShowNotification] = useState(false);
  const [showPopConfirm, setShowPopConfirm] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight - HEADER_HEIGHT });

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const hasInitializedPanRef = useRef(false);


  const resetDragState = () => {
    window.setTimeout(() => {
      dragMovedRef.current = false;
      activePointerIdRef.current = null;
      setIsDragging(false);
    }, 0);
  };

  const myFallbackInterests: Interest[] = [
    { id: 'm1', text: '영화', level: 'deep1' },
    { id: 'm2', text: '브런치', level: 'deep2' }
  ];

  const participants: Participant[] = [
    {
      id: 'me',
      name: '나',
      color: 'from-purple-400 to-pink-400',
      interests: myInterests.length > 0 ? myInterests : myFallbackInterests
    },
    {
      id: 'user2',
      name: 'user2',
      color: 'from-blue-400 to-cyan-400',
      interests: [
        { id: 'u2-d1-1', text: '리그오브레전드', level: 'deep1' },
        { id: 'u2-d1-2', text: '야구', level: 'deep1' },
        { id: 'u2-d2-1', text: '두산', level: 'deep2' },
        { id: 'u2-d2-2', text: '티원', level: 'deep2' }
      ]
    },
    {
      id: 'user3',
      name: 'user3',
      color: 'from-green-400 to-emerald-400',
      interests: [
        { id: 'u3-d1-1', text: '디저트먹기', level: 'deep1' },
        { id: 'u3-d1-2', text: '맛집탐방', level: 'deep1' },
        { id: 'u3-d2-1', text: '스티커 모으기', level: 'deep2' }
      ]
    }
  ];

  const fieldBubbles = useMemo(() => {
    return buildWorldLayout(participants);
  }, [myInterests]);
  console.log('BUBBLE COUNT:', fieldBubbles.length);

  const getInitialCamera = useCallback((width: number, height: number) => {
    // Camera is world coordinates of the center of the viewport
    // Center on world origin (0,0)
    return { x: 0, y: 0 };
  }, []);

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
    if (hasInitializedPanRef.current) return;
    setCamera(getInitialCamera(viewportSize.width, viewportSize.height));
    hasInitializedPanRef.current = true;
  }, [getInitialCamera, viewportSize]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

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

  return (
    <div
      className="h-screen w-screen overflow-hidden fixed inset-0 bg-gradient-to-b from-purple-50/30 to-white select-none"
      style={{
        overscrollBehavior: 'none'
      }}
    >
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

      <div
        style={{
          marginTop: HEADER_HEIGHT,
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          background: 'yellow',
          position: 'relative'
        }}
      >
        <div
          className="relative h-full w-full"
          style={{ outline: '2px solid blue', background: 'rgba(0,0,255,0.05)' }}
        >
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
              // overflow: 'hidden',
              touchAction: 'none',
              cursor: isDragging ? 'grabbing' : 'grab',
              outline: 'none',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              WebkitUserSelect: 'none',
              border: 'none',
              boxShadow: 'none',
              background: 'rgba(255,0,0,0.03)'
            }}
          >
            <div
              className="relative"
              style={{ position: 'relative', width: '100%', height: '100%' }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '80px',
                  height: '80px',
                  background: 'red',
                  borderRadius: '50%',
                  zIndex: 9999
                }}
              />
              {fieldBubbles.map((bubble, index) => {
                const isSelected = selectedBubble?.id === bubble.interest.id;
                return (
                  <div
                    key={`${bubble.participantId}-${bubble.interest.id}-${index}`}
                    onClick={() => handleBubbleTap(bubble)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleBubbleTap(bubble);
                      }
                    }}
                    className={`${bubble.isMine ? 'cursor-default' : 'cursor-pointer'} ${isSelected ? 'ring-4 ring-white/90' : ''} select-none focus:outline-none focus:ring-0`}
                    style={{
                      position: 'absolute',
                      left: `${bubble.worldX - camera.x + (viewportSize.width || window.innerWidth) / 2}px`,
                      top: `${bubble.worldY - camera.y + (viewportSize.height || (window.innerHeight - HEADER_HEIGHT)) / 2}px`,
                      width: `${bubble.size}px`,
                      height: `${bubble.size}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '9999px',
                      zIndex: isSelected ? 20 : 10,
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      outline: 'none',
                      transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                      touchAction: 'none',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${bubble.participantColor} rounded-full shadow-md`}
                    />
                    <div className="absolute inset-[7%] rounded-full bg-white/10" />
                    <div className="absolute top-[16%] right-[18%] w-8 h-8 rounded-full bg-white/20 blur-sm" />
                    <div className="relative z-10 px-3 flex flex-col items-center justify-center text-center">
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          lineHeight: 1.2,
                          wordBreak: 'keep-all',
                          maxWidth: '90px'
                        }}
                        className="text-white"
                      >
                        {bubble.interest.text}
                      </span>
                      <span className="mt-2 text-[10px] uppercase tracking-[0.18em] opacity-80 text-white">
                        {bubble.isMine ? 'mine' : bubble.participantName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onShowCommonGround}
        className="fixed bottom-6 right-5 w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-xl shadow-purple-300/50 flex items-center justify-center active:scale-95 transition-transform z-50"
        style={{ touchAction: 'manipulation' }}
      >
        <Sparkles className="w-6 h-6 text-white" />
      </button>

      {showNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
          <div className="bg-purple-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {selectedParticipant
                ? `${selectedParticipant.name}가 당신의 관심사를 확인했어요!`
                : '관심사를 확인했어요!'}
            </span>
          </div>
        </div>
      )}

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