import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle, Lock, LogOut, Sparkles, Users, RefreshCw } from 'lucide-react';
import { appEnv } from '../config/env';
import type { ApiRoomEvent } from '../types/api';
import type { Interest, Participant, Screen } from '../types/bubble';
import BubbleField from '../components/BubbleField';
import {
  approveDeep3Unlock,
  finishRoom,
  leaveRoom,
  popBubble,
  rejectDeep3Unlock,
  requestDeep3Unlock
} from '../api/room';
import { ApiUnauthorizedError } from '../api/client';
import { isSessionGoneError } from '../api/errors';
import {
  buildWorldLayout,
  getBubbleMotionValues,
  type FieldBubble
} from '../features/bubble-field/fieldLayout';
import { useRoomPolling } from '../features/bubble-field/useRoomPolling';

const SESSION_EXPIRED_MESSAGE = '세션이 만료됐어요. 다시 입장해주세요.';

const HEADER_HEIGHT = 72;
const DEMO_MODE = appEnv.demoMode;

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
  onEventsLoaded,
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
  onEventsLoaded: (events: ApiRoomEvent[]) => void;
  onShowCommonGround: () => void;
  selectedBubble: Interest | null;
  setSelectedBubble: (bubble: Interest | null) => void;
  onNavigate: (screen: Screen) => void;
  onResetSession: (message?: string) => void;
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
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [recommendationInterest, setRecommendationInterest] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const {
    participants,
    events,
    isLoading,
    isRefreshing,
    error,
    setError,
    roomStatus,
    hostUserId,
    refresh: fetchFieldData,
    stopPolling,
    resumePolling
  } = useRoomPolling({
    roomCode,
    currentUserId,
    setCurrentUserId,
    onParticipantsLoaded,
    onEventsLoaded,
    onNavigate,
    onResetSession
  });

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const lastCameraLayoutKeyRef = useRef('');
  const handledAcceptedEventsRef = useRef<Set<string>>(new Set());
  const handledPopNotificationsRef = useRef<Set<string>>(new Set());
  const handledPendingRequestNotificationsRef = useRef<Set<string>>(new Set());

  const isHost = hostUserId === currentUserId;

  const fieldBubbles = useMemo(() => {
    return buildWorldLayout(participants, currentUserId);
  }, [participants, currentUserId]);

  // 이미 내가 pop한 (deep2) 버블은 다시 볼 때 블러 처리하지 않기 위한 키 집합.
  const revealedBubbleKeys = useMemo(() => {
    const keys = new Set<string>();
    events.forEach((event) => {
      if (event.eventType === 'pop' && event.sourceUserId === currentUserId) {
        keys.add(`${event.targetUserId}:${event.interestId}`);
      }
    });
    return keys;
  }, [events, currentUserId]);

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

  // 내 버블을 상대가 pop했을 때 나에게도 알림을 띄운다.
  useEffect(() => {
    const poppedMineEvents = events.filter(
      (event) =>
        event.eventType === 'pop' &&
        event.targetUserId === currentUserId &&
        !handledPopNotificationsRef.current.has(event.id)
    );

    poppedMineEvents.forEach((event) => {
      handledPopNotificationsRef.current.add(event.id);
      const sourceName =
        participants.find((participant) => participant.id === event.sourceUserId)?.name ?? '누군가';
      const interestText = findInterestText(participants, currentUserId, event.interestId);
      setNotificationMessage(`${sourceName}님이 당신의 '${interestText}' 버블을 확인했어요!`);
      setShowNotification(true);
      setRecommendationInterest(interestText);
    });
  }, [events, currentUserId, participants]);

  // 비공개(deep3) 관심사 열람 요청이 새로 들어왔을 때 나에게 알림을 띄운다.
  useEffect(() => {
    const newPendingRequests = events.filter(
      (event) =>
        event.eventType === 'deep3_request' &&
        event.targetUserId === currentUserId &&
        event.status === 'pending' &&
        !handledPendingRequestNotificationsRef.current.has(event.id)
    );

    newPendingRequests.forEach((event) => {
      handledPendingRequestNotificationsRef.current.add(event.id);
      const sourceName =
        participants.find((participant) => participant.id === event.sourceUserId)?.name ?? '누군가';
      setNotificationMessage(`${sourceName}님이 비공개 관심사 열람을 요청했어요! 아래 활동 목록에서 확인해보세요`);
      setShowNotification(true);
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
      if (actionError instanceof ApiUnauthorizedError) {
        onResetSession(SESSION_EXPIRED_MESSAGE);
        return;
      }
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
      if (approveError instanceof ApiUnauthorizedError) {
        onResetSession(SESSION_EXPIRED_MESSAGE);
        return;
      }
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
      if (rejectError instanceof ApiUnauthorizedError) {
        onResetSession(SESSION_EXPIRED_MESSAGE);
        return;
      }
      setError(rejectError instanceof Error ? rejectError.message : '거절 처리에 실패했어요');
    }
  };

  const handleFinish = async () => {
    try {
      setIsFinishing(true);
      await finishRoom(roomCode);
      onNavigate('recommendation');
    } catch (finishError) {
      if (finishError instanceof ApiUnauthorizedError) {
        onResetSession(SESSION_EXPIRED_MESSAGE);
        return;
      }
      setError(finishError instanceof Error ? finishError.message : '완료 처리에 실패했어요');
    } finally {
      setIsFinishing(false);
    }
  };

  const handleLeave = async () => {
    if (isLeaving) return;

    // 폴링을 먼저 멈춰서 in-flight 응답이 나가기 이후 상태를 건드리지 못하게 한다.
    stopPolling();

    try {
      setIsLeaving(true);
      await leaveRoom(roomCode);
      onResetSession();
    } catch (leaveError) {
      if (isSessionGoneError(leaveError)) {
        onResetSession();
        return;
      }
      // 나가기에 실패했으니 폴링을 다시 켠다.
      resumePolling();
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
        <div className="relative flex items-center gap-3 h-full px-5 w-full">
          <button
            onClick={() => {
              void handleLeave();
            }}
            disabled={isLeaving}
            aria-label="뒤로가기"
            className="w-9 h-9 shrink-0 bg-white rounded-full border border-purple-100 shadow-sm flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>

          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">버블 필드</h3>
            <p className="text-xs text-gray-500">버블을 눌러 관심사를 확인하세요</p>
          </div>

          <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-right">
            {DEMO_MODE && (
              <button
                onClick={() => {
                  void fetchFieldData({ showRefreshing: true });
                }}
                disabled={isRefreshing}
                className="h-10 px-3 bg-white text-amber-700 rounded-full border border-amber-200 shadow-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-xs font-semibold">
                  {isRefreshing ? '갱신 중' : '수동 갱신'}
                </span>
              </button>
            )}
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
                      {error ?? '참여자들의 관심사로 버블을 만들고 있어요'}
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
                        isRevealed={
                          bubble.isMine || revealedBubbleKeys.has(`${bubble.participantId}:${bubble.interest.id}`)
                        }
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
          aria-label="활동 패널 열기"
          className="w-14 h-14 bg-white/95 rounded-full shadow-xl border border-purple-100 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Users className="w-6 h-6 text-purple-600" />
        </button>
        <button
          onClick={() => {
            void handleLeave();
          }}
          disabled={isLeaving}
          aria-label="방 나가기"
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
          aria-label="공통점 보기"
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
