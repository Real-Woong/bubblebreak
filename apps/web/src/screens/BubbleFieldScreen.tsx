import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Lock, LogOut, Sparkles, Users } from 'lucide-react';
import type { ApiRoomEvent } from '../types/api';
import type { Interest, Participant, Screen } from '../types/bubble';
import BubbleField from '../components/BubbleField';
import {
  approveDeep3Unlock,
  finishRoom,
  getRoom,
  getRoomEvents,
  getRoomMe,
  heartbeat,
  leaveRoom,
  popBubble,
  rejectDeep3Unlock,
  requestDeep3Unlock
} from '../api/room';
import { mapApiParticipantsToParticipants } from '../mappers/room';

type FieldBubble = {
  id: string;
  interest: Interest;
  participantId: string;
  participantName: string;
  worldX: number;
  worldY: number;
  size: number;
  isMine: boolean;
};

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
        worldX: placedBubble.x,
        worldY: placedBubble.y,
        size: placedBubble.size,
        isMine: participant.id === currentUserId
      });
    });
  });

  return bubbles;
}

function getBubbleMotionValues(bubble: FieldBubble, index: number) {
  const floatDuration = 6.8 + seededRandom(index * 37 + bubble.participantId.length * 19) * 2.6;
  const swayDuration = 5.4 + seededRandom(index * 41 + bubble.participantName.length * 11) * 1.8;
  const floatX = Math.round(8 + seededRandom(index * 71 + bubble.size) * 10);
  const floatY = Math.round(12 + seededRandom(index * 89 + bubble.size) * 14);
  const rotateDeg = (1.8 + seededRandom(index * 61 + bubble.size * 3) * 2.4).toFixed(2);
  const delay = -(seededRandom(index * 29 + bubble.interest.id.length * 17) * 4.8);

  return {
    floatDuration,
    swayDuration,
    floatX,
    floatY,
    rotateDeg,
    delay
  };
}

function getEventLabel(event: ApiRoomEvent, participants: Participant[], currentUserId: string) {
  const source = participants.find((participant) => participant.id === event.sourceUserId)?.name ?? '누군가';
  const target = participants.find((participant) => participant.id === event.targetUserId)?.name ?? '상대방';
  const actorIsMe = event.sourceUserId === currentUserId;

  if (event.eventType === 'pop') {
    return actorIsMe
      ? `${target}의 버블을 확인했어요`
      : `${source}가 내 버블에 반응했어요`;
  }

  if (event.status === 'pending') {
    return actorIsMe
      ? `${target}에게 private 관심사 요청을 보냈어요`
      : `${source}가 내 private 관심사를 요청했어요`;
  }

  if (event.status === 'accepted') {
    return actorIsMe ? `${target}가 요청을 수락했어요` : `${source}의 요청을 수락했어요`;
  }

  return actorIsMe ? `${target}가 요청을 거절했어요` : `${source}의 요청을 거절했어요`;
}

function findInterestText(participants: Participant[], userId: string, interestId: string) {
  const participant = participants.find((item) => item.id === userId);
  return participant?.interests.find((interest) => interest.id === interestId)?.text ?? '이 관심사';
}

export default function BubbleFieldScreen({
  roomCode,
  currentUserId,
  setCurrentUserId,
  onParticipantsLoaded,
  onShowCommonGround,
  selectedBubble,
  setSelectedBubble,
  onNavigate,
  onResetSession
}: {
  roomCode: string;
  currentUserId: string;
  setCurrentUserId: (userId: string) => void;
  onParticipantsLoaded: (participants: Participant[]) => void;
  onShowCommonGround: () => void;
  selectedBubble: Interest | null;
  setSelectedBubble: (bubble: Interest | null) => void;
  onNavigate: (screen: Screen) => void;
  onResetSession: () => void;
}) {
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('관심사를 확인했어요!');
  const [showPopConfirm, setShowPopConfirm] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight - HEADER_HEIGHT
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [events, setEvents] = useState<ApiRoomEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<string>('');
  const [hostUserId, setHostUserId] = useState('');
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [recommendationInterest, setRecommendationInterest] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const lastCameraLayoutKeyRef = useRef('');
  const handledAcceptedEventsRef = useRef<Set<string>>(new Set());

  const isHost = hostUserId === currentUserId;

  const fieldBubbles = useMemo(() => {
    return buildWorldLayout(participants, currentUserId);
  }, [participants, currentUserId]);

  const resetDragState = () => {
    window.setTimeout(() => {
      dragMovedRef.current = false;
      activePointerIdRef.current = null;
      setIsDragging(false);
    }, 0);
  };

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

  const fetchFieldData = useCallback(async () => {
    if (!roomCode) return;

    try {
      setError(null);

      const [roomResponse, eventsResponse] = await Promise.all([
        getRoom(roomCode),
        getRoomEvents(roomCode)
      ]);

      if (!currentUserId) {
        const me = await getRoomMe(roomCode);
        setCurrentUserId(me.me.userId);
      }

      const mappedParticipants = mapApiParticipantsToParticipants(roomResponse.participants);

      setParticipants(mappedParticipants);
      onParticipantsLoaded(mappedParticipants);
      setEvents(eventsResponse.events);
      setRoomStatus(roomResponse.room.status);
      setHostUserId(roomResponse.room.hostUserId);

      if (roomResponse.room.status === 'finished') {
        onNavigate('recommendation');
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '버블 필드 데이터를 불러오지 못했어요');
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, currentUserId, onParticipantsLoaded, onNavigate, setCurrentUserId]);

  useEffect(() => {
    setIsLoading(true);
    void fetchFieldData();

    const intervalId = window.setInterval(() => {
      void fetchFieldData();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [fetchFieldData]);

  useEffect(() => {
    const heartbeatInterval = window.setInterval(() => {
      void heartbeat(roomCode).catch(() => {
        // no-op
      });
    }, 25000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void heartbeat(roomCode).catch(() => {
          // no-op
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [roomCode]);

  useEffect(() => {
    const acceptedEvents = events.filter(
      (event) =>
        event.eventType === 'deep3_request' &&
        event.sourceUserId === currentUserId &&
        event.status === 'accepted' &&
        !handledAcceptedEventsRef.current.has(event.id)
    );

    acceptedEvents.forEach((event) => {
      handledAcceptedEventsRef.current.add(event.id);
      setNotificationMessage('private 관심사 요청이 수락됐어요!');
      setShowNotification(true);
      setRecommendationInterest(findInterestText(participants, event.targetUserId, event.interestId));
    });
  }, [events, currentUserId, participants]);

  useEffect(() => {
    if (!showNotification) return;

    const timeoutId = window.setTimeout(() => {
      setShowNotification(false);
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [showNotification]);

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

  const handleBubbleTap = (bubble: FieldBubble) => {
    if (dragMovedRef.current || bubble.isMine) return;
    setSelectedParticipant(
      participants.find((participant) => participant.id === bubble.participantId) ?? null
    );
    setSelectedBubble(bubble.interest);
    setShowPopConfirm(true);
  };

  const handlePop = async () => {
    if (!selectedParticipant || !selectedBubble || isActionSubmitting) return;

    try {
      setIsActionSubmitting(true);

      if (selectedBubble.level === 'deep3') {
        await requestDeep3Unlock(roomCode, {
          targetUserId: selectedParticipant.id,
          interestId: selectedBubble.id
        });
        setNotificationMessage(`${selectedParticipant.name}에게 확인 요청을 보냈어요!`);
      } else {
        await popBubble(roomCode, {
          targetUserId: selectedParticipant.id,
          interestId: selectedBubble.id
        });
        setNotificationMessage(`${selectedParticipant.name}의 관심사를 확인했어요!`);
        setRecommendationInterest(selectedBubble.text);
      }

      setShowPopConfirm(false);
      setShowNotification(true);
      setSelectedBubble(null);
      setSelectedParticipant(null);
      await fetchFieldData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '상호작용 처리에 실패했어요');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleApprove = async (eventId: string) => {
    try {
      await approveDeep3Unlock(roomCode, eventId);
      setNotificationMessage('요청을 수락했어요');
      setShowNotification(true);
      await fetchFieldData();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : '수락 처리에 실패했어요');
    }
  };

  const handleReject = async (eventId: string) => {
    try {
      await rejectDeep3Unlock(roomCode, eventId);
      setNotificationMessage('요청을 거절했어요');
      setShowNotification(true);
      await fetchFieldData();
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : '거절 처리에 실패했어요');
    }
  };

  const handleFinish = async () => {
    try {
      setIsFinishing(true);
      await finishRoom(roomCode);
      onNavigate('recommendation');
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : '완료 처리에 실패했어요');
    } finally {
      setIsFinishing(false);
    }
  };

  const handleLeave = async () => {
    try {
      setIsLeaving(true);
      await leaveRoom(roomCode);
      onResetSession();
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : '방 나가기에 실패했어요');
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <div
      className="h-screen w-screen overflow-hidden fixed inset-0 bg-gradient-to-b from-purple-50/30 to-white select-none"
      style={{ overscrollBehavior: 'none' }}
    >
      <style>{`
        @keyframes bubbleDrift {
          0% { transform: translate3d(0px, 0px, 0); }
          25% { transform: translate3d(var(--float-x), calc(var(--float-y) * -0.55), 0); }
          50% { transform: translate3d(calc(var(--float-x) * -0.35), calc(var(--float-y) * -1), 0); }
          75% { transform: translate3d(calc(var(--float-x) * -1), calc(var(--float-y) * -0.2), 0); }
          100% { transform: translate3d(0px, 0px, 0); }
        }

        @keyframes bubbleSway {
          0% { transform: rotate(0deg) scale(1, 1); }
          25% { transform: rotate(calc(var(--rotate-deg) * -1deg)) scale(1.016, 0.992); }
          50% { transform: rotate(calc(var(--rotate-deg) * 0.6deg)) scale(1.026, 0.986); }
          75% { transform: rotate(calc(var(--rotate-deg) * -0.5deg)) scale(1.012, 0.996); }
          100% { transform: rotate(0deg) scale(1, 1); }
        }
      `}</style>

      <div
        className="fixed top-0 left-0 right-0 z-40 bg-white/92 backdrop-blur-md border-b border-purple-100"
        style={{ height: `${HEADER_HEIGHT}px`, width: '100%', boxSizing: 'border-box' }}
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

      <div style={{ marginTop: HEADER_HEIGHT, height: `calc(100vh - ${HEADER_HEIGHT}px)`, position: 'relative' }}>
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
              WebkitUserSelect: 'none'
            }}
          >
            <div className="relative" style={{ width: '100%', height: '100%' }}>
              {(isLoading || error || fieldBubbles.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                  <div className="rounded-3xl bg-white/80 backdrop-blur-sm px-6 py-5 shadow-sm border border-purple-100">
                    <p className="text-sm font-medium text-gray-700">
                      {isLoading
                        ? '버블 데이터를 불러오는 중이에요'
                        : error
                          ? '버블 데이터를 불러오지 못했어요'
                          : '아직 표시할 버블 데이터가 없어요'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {error ?? '현재 room participants 기준으로 버블을 구성하고 있어요'}
                    </p>
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

      <div className="fixed bottom-6 left-5 z-50 flex gap-3">
        <button
          onClick={() => setIsActivityOpen((prev) => !prev)}
          className="w-14 h-14 bg-white/95 rounded-full shadow-xl border border-purple-100 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Users className="w-6 h-6 text-purple-600" />
        </button>
        <button
          onClick={() => {
            void handleLeave();
          }}
          disabled={isLeaving}
          className="w-14 h-14 bg-gray-900 rounded-full shadow-xl flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
        >
          <LogOut className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="fixed bottom-6 right-5 z-50 flex gap-3">
        {isHost && roomStatus === 'started' && (
          <button
            onClick={() => {
              void handleFinish();
            }}
            disabled={isFinishing}
            className="px-5 h-14 bg-white/95 text-purple-700 rounded-full shadow-xl border border-purple-100 font-semibold active:scale-95 transition-transform disabled:opacity-50"
          >
            {isFinishing ? '완료 중...' : 'Bubble Breaking 완료'}
          </button>
        )}

        <button
          onClick={onShowCommonGround}
          className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-xl shadow-purple-300/50 flex items-center justify-center active:scale-95 transition-transform"
          style={{ touchAction: 'manipulation' }}
        >
          <Sparkles className="w-6 h-6 text-white" />
        </button>
      </div>

      {isActivityOpen && (
        <div className="fixed inset-x-4 bottom-24 z-50 bg-white/95 backdrop-blur-md rounded-3xl border border-purple-100 shadow-2xl p-4 max-h-[42vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">활동 패널</h4>
            <button
              onClick={() => setIsActivityOpen(false)}
              className="text-xs text-gray-500"
            >
              닫기
            </button>
          </div>

          <div className="space-y-3">
            {events.map((event) => {
              const canRespond =
                event.eventType === 'deep3_request' &&
                event.targetUserId === currentUserId &&
                event.status === 'pending';

              return (
                <div key={event.id} className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
                  <p className="text-sm text-gray-700">{getEventLabel(event, participants, currentUserId)}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(event.createdAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>

                  {canRespond && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          void handleApprove(event.id);
                        }}
                        className="flex-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 text-sm font-semibold"
                      >
                        수락
                      </button>
                      <button
                        onClick={() => {
                          void handleReject(event.id);
                        }}
                        className="flex-1 rounded-full bg-gray-200 text-gray-700 py-2 text-sm font-semibold"
                      >
                        거절
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {events.length === 0 && (
              <div className="rounded-2xl border border-dashed border-purple-100 bg-white px-4 py-5 text-center text-sm text-gray-500">
                아직 기록된 활동이 없어요
              </div>
            )}
          </div>
        </div>
      )}

      {showNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
          <div className="bg-purple-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{notificationMessage}</span>
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
                  ? '상대방에게 unlock 요청을 보내요'
                  : '관심사에 반응을 보내고 추천 질문을 볼 수 있어요'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2">
                {selectedBubble.level === 'deep3' && (
                  <Lock className="w-5 h-5 text-purple-500" />
                )}
                <span className="font-semibold text-gray-900">
                  {selectedBubble.level === 'deep3' ? selectedBubble.text : selectedBubble.text}
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
                onClick={() => {
                  void handlePop();
                }}
                disabled={isActionSubmitting}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3.5 rounded-full font-semibold active:scale-95 transition-transform disabled:opacity-50"
              >
                {isActionSubmitting
                  ? '처리 중...'
                  : selectedBubble.level === 'deep3'
                    ? '요청 보내기'
                    : '터뜨리기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {recommendationInterest && (
        <div
          className="fixed inset-0 bg-black/35 z-50 flex items-end"
          onClick={() => setRecommendationInterest(null)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <h3 className="font-bold text-gray-900 text-lg">이 주제로 대화를 이어가보세요</h3>
              <p className="text-sm text-gray-600 mt-1">{recommendationInterest}</p>
            </div>

            <div className="space-y-3">
              {[
                `${recommendationInterest} 좋아하게 된 계기가 뭐예요?`,
                `요즘 ${recommendationInterest} 관련해서 가장 재미있었던 순간은 언제였어요?`,
                `${recommendationInterest} 이야기부터 시작하면 제일 자연스러울 것 같아요`
              ].map((line) => (
                <div
                  key={line}
                  className="rounded-2xl border border-purple-100 bg-purple-50/50 px-4 py-3 text-sm text-gray-700"
                >
                  {line}
                </div>
              ))}
            </div>

            <button
              onClick={() => setRecommendationInterest(null)}
              className="mt-5 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3.5 rounded-full font-semibold"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
