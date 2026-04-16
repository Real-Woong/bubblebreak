import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Users, Sparkles, CheckCircle, Lock } from 'lucide-react';
import type { Interest, Participant } from '../types/bubble';
import BubbleField from '../components/BubbleField';

// ============================================================
// BubbleFieldScreen
// Lobby 이후 진입하는 메인 인터랙션 화면
//
// 역할:
// - 현재는 App.tsx 에서 주입받은 임시 participants 데이터를 기반으로 버블을 렌더링
// - 이후에는 room_participants API 응답 데이터를 이 화면에서 사용하도록 전환 예정
// - camera(가상 카메라)를 이동시키며 월드 탐색
// - 다른 유저의 관심사를 터치하여 상호작용
//
// 핵심 구조:
// 현재: App의 mock/임시 participants → interests → FieldBubble → 렌더링
// 이후: API(room_participants) → parsing(interests_json) → FieldBubble → 렌더링
// world 좌표 → camera 보정 → screen 좌표
// ============================================================

// ============================================================
// 타입 정의
// ============================================================

// FieldBubble: 실제 화면에 렌더링되는 버블 단위
// - interest: 원본 데이터
// - participant 정보: 소유자
// - worldX/Y: 월드 좌표
// - size: 크기
// - isMine: 내 버블 여부
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

// 사용자별 색상 시스템
// 동일 유저는 항상 같은 색 계열 유지
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

// participantId → user slot 매핑
// 색상/스타일 통일을 위한 정규화 과정
function getUserSlot(participantId: string) {
  if (participantId === 'me' || participantId === 'user-1' || participantId === 'user1') {
    return 'user1';
  }

  const numericMatch = participantId.match(/\d+/);
  const numericId = numericMatch ? Number(numericMatch[0]) : 1;

  const normalized = Math.min(Math.max(numericId, 1), 6);
  return `user${normalized}` as keyof typeof USER_MAIN_GRADIENTS;
}

// interest level에 따른 그라데이션 선택
function getBubbleGradient(participantId: string, level: Interest['level']) {
  const userSlot = getUserSlot(participantId);
  return USER_MAIN_GRADIENTS[userSlot][level];
}

// 사용자별 shadow 차별화 (시각적 구분 강화)
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

// 레이아웃 관련 상수 정의
// 버블 간 거리, 반경, 최소 간격 등
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

// seed 기반 랜덤 → 동일 데이터에서 항상 같은 배치 보장
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}


// 두 버블이 겹치는지 계산
function bubblesOverlap(
  a: { x: number; y: number; size: number },
  b: { x: number; y: number; size: number }
) {
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  return distance < a.size / 2 + b.size / 2 + MIN_BUBBLE_GAP;
}

// 겹치지 않는 위치 탐색 알고리즘
// 반경을 점점 넓히며 빈 공간 찾기
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

// 핵심 레이아웃 생성 함수
// participants → bubble 좌표 계산
// 클러스터 기반 + 충돌 회피
function buildWorldLayout(participants: Participant[], currentUserId: string) {
  const participantCount = Math.max(participants.length, 1);
  const clusters: Record<string, { x: number; y: number }> = {};

  // participant 중심 좌표 계산 (원형 배치)
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
      // 최종 bubble 객체 생성
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

// 버블 애니메이션 값 생성 (부유, 회전 등)
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
  // UI 상태 관리 (선택, 토스트, 모달 등)
  // --------------------------------------------
  const [showNotification, setShowNotification] = useState(false);
  const [showPopConfirm, setShowPopConfirm] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight - HEADER_HEIGHT });

  // --------------------------------------------
  // 드래그 및 포인터 상태 관리
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
  // 드래그 상태 초기화
  // --------------------------------------------
  const resetDragState = () => {
    window.setTimeout(() => {
      dragMovedRef.current = false;
      activePointerIdRef.current = null;
      setIsDragging(false);
    }, 0);
  };

  // --------------------------------------------
  // 현재 데이터 주입 방식
  // - 지금은 App.tsx 에서 participants / currentUserId 를 props로 내려받는다.
  // - 즉, 아직 이 화면 자체가 서버 fetch를 하지는 않는다.
  //
  // TODO (API 연결 시):
  // 1. roomCode 기준으로 room_participants 조회
  // 2. interests_json 문자열을 Interest[] 로 파싱
  // 3. Participant 화면 타입으로 매핑
  // 4. 그 결과를 fieldBubbles 생성의 입력값으로 사용
  // --------------------------------------------

  // TODO (API 연결 예정 위치)
  // 현재는 props 기반이라 실제 fetch/useEffect를 돌리지 않는다.
  // 백엔드 준비 후 이 자리에 아래와 같은 흐름이 들어올 예정:
  //
  // useEffect(() => {
  //   // 1. GET /rooms/:code 또는 field 전용 endpoint 호출
  //   // 2. room_participants 응답 수신
  //   // 3. interests_json 파싱
  //   // 4. local state(setParticipantsFromApi)에 저장
  // }, [roomCode]);
  //
  // 그 이후 buildWorldLayout의 입력을 props participants가 아니라
  // API에서 가공한 participants 상태로 바꾸면 된다.

  // 현재는 props로 받은 participants를 bubble 데이터로 변환한다.
  // TODO: API 연결 후에는 "가공된 room_participants 상태"를 이 입력값으로 교체할 예정.
  const fieldBubbles = useMemo(() => {
    return buildWorldLayout(participants, currentUserId);
  }, [participants, currentUserId]);

  // 전체 버블을 중앙에 배치하는 초기 카메라 계산
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

  // viewport 크기 추적 (resize 대응)
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

  // 레이아웃 변경 시 camera 재정렬
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

  // 포인터 기반 카메라 이동 처리
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

  // 버블 클릭 처리 (상호작용 시작)
  // 현재는 프론트 내부 상태만 변경한다.
  // TODO: API 연결 후에는 공개 처리 / 요청 전송 등의 서버 액션이 이 흐름에 연결될 수 있다.
  const handleBubbleTap = (bubble: FieldBubble) => {
    if (dragMovedRef.current) return;
    if (bubble.isMine) return;
    setSelectedParticipant(
      participants.find((participant) => participant.id === bubble.participantId) ?? null
    );
    setSelectedBubble(bubble.interest);
    setShowPopConfirm(true);
  };

  // 버블 터뜨리기 로직 (알림 포함)
  // 현재는 mock 상호작용만 처리한다.
  // TODO: API 연결 후에는 여기서 공개 처리, 요청 생성, 상태 동기화 등을 호출할 수 있다.
  const handlePop = () => {
    setShowPopConfirm(false);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
      setSelectedBubble(null);
      setSelectedParticipant(null);
    }, 3000);
  };

  // ==============================
  // 렌더링 시작
  // ==============================
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
      {/* 상단 헤더: 제목 + 참가자 수 */}
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

      {/* 버블 필드 영역 (카메라 이동 대상) */}
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
              {/* 데이터 없음 상태 */}
              {fieldBubbles.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                  <div className="rounded-3xl bg-white/80 backdrop-blur-sm px-6 py-5 shadow-sm border border-purple-100">
                    <p className="text-sm font-medium text-gray-700">아직 표시할 버블 데이터가 없어요</p>
                    <p className="mt-1 text-xs text-gray-500">
                      현재는 임시 participants 데이터가 비어 있거나, 이후 API 데이터가 아직 연결되지 않은 상태예요
                    </p>
                  </div>
                </div>
              )}
              {/* 버블 렌더링 (world → screen 좌표 변환)
                  - 현재는 props participants 기반
                  - 이후에는 API에서 받은 room_participants 가공 결과 기반으로 렌더링 */}
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

      {/* 공통 관심사 버튼 */}
      <button
        onClick={onShowCommonGround}
        className="fixed bottom-6 right-5 w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-xl shadow-purple-300/50 flex items-center justify-center active:scale-95 transition-transform z-50"
        style={{ touchAction: 'manipulation' }}
      >
        <Sparkles className="w-6 h-6 text-white" />
      </button>

      {/* 상호작용 결과 알림 */}
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

      {/* 버블 액션 UI */}
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