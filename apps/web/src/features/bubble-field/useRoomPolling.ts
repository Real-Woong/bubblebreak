import { useCallback, useEffect, useRef, useState } from 'react';
import { getRoom, getRoomEvents, getRoomMe, heartbeat } from '../../api/room';
import { isAbortError, isSessionGoneError, sessionGoneMessage } from '../../api/errors';
import { appEnv } from '../../config/env';
import { mapApiParticipantsToParticipants } from '../../mappers/room';
import type { ApiRoomEvent } from '../../types/api';
import type { Participant, Screen } from '../../types/bubble';

type UseRoomPollingOptions = {
  roomCode: string;
  currentUserId: string;
  setCurrentUserId: (userId: string) => void;
  onParticipantsLoaded: (participants: Participant[]) => void;
  onEventsLoaded: (events: ApiRoomEvent[]) => void;
  onNavigate: (screen: Screen) => void;
  onResetSession: (message?: string) => void;
};

export function useRoomPolling(options: UseRoomPollingOptions) {
  const {
    roomCode,
    currentUserId,
    setCurrentUserId,
    onParticipantsLoaded,
    onEventsLoaded,
    onNavigate,
    onResetSession
  } = options;
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [events, setEvents] = useState<ApiRoomEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState('');
  const [hostUserId, setHostUserId] = useState('');
  // 폴링 수명 관리용 컨트롤러. abort되면 in-flight 응답은 무시되고 상태 전환도 일어나지 않는다.
  const controllerRef = useRef<AbortController | null>(null);
  // 방 나가기 실패 후 폴링을 다시 켤 때 effect를 재실행하기 위한 카운터
  const [pollEpoch, setPollEpoch] = useState(0);

  const stopPolling = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const resumePolling = useCallback(() => {
    setPollEpoch((epoch) => epoch + 1);
  }, []);

  const refresh = useCallback(async (refreshOptions?: { showRefreshing?: boolean }) => {
    const signal = controllerRef.current?.signal;
    if (!roomCode || !signal || signal.aborted) return;

    try {
      if (refreshOptions?.showRefreshing) setIsRefreshing(true);
      setError(null);

      const [roomResponse, eventsResponse] = await Promise.all([
        getRoom(roomCode, { signal }),
        getRoomEvents(roomCode, { signal })
      ]);

      if (!currentUserId) {
        const me = await getRoomMe(roomCode, { signal });
        if (signal.aborted) return;
        setCurrentUserId(me.me.userId);
      }

      // 나가기/언마운트 등으로 중단된 뒤 도착한 응답은 버린다.
      if (signal.aborted) return;

      const nextParticipants = mapApiParticipantsToParticipants(roomResponse.participants);
      setParticipants(nextParticipants);
      setEvents(eventsResponse.events);
      setRoomStatus(roomResponse.room.status);
      setHostUserId(roomResponse.room.hostUserId);
      onParticipantsLoaded(nextParticipants);
      onEventsLoaded(eventsResponse.events);

      if (roomResponse.room.status === 'finished') onNavigate('recommendation');
    } catch (refreshError) {
      if (signal.aborted || isAbortError(refreshError)) return;
      if (isSessionGoneError(refreshError)) {
        // 404/401/403이면 폴링을 멈추고 세션을 정리한다.
        controllerRef.current?.abort();
        onResetSession(sessionGoneMessage(refreshError));
        return;
      }
      setError(refreshError instanceof Error ? refreshError.message : '버블 필드 데이터를 불러오지 못했어요');
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
        if (refreshOptions?.showRefreshing) setIsRefreshing(false);
      }
    }
  }, [
    roomCode,
    currentUserId,
    setCurrentUserId,
    onParticipantsLoaded,
    onEventsLoaded,
    onNavigate,
    onResetSession
  ]);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    void refresh();
    if (appEnv.demoMode) return () => controller.abort();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, appEnv.fieldRoomPollingIntervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refresh, pollEpoch]);

  useEffect(() => {
    if (appEnv.demoMode || !roomCode) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void heartbeat(roomCode).catch(() => undefined);
    }, appEnv.fieldHeartbeatIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [roomCode]);

  return {
    participants,
    events,
    isLoading,
    isRefreshing,
    error,
    setError,
    roomStatus,
    hostUserId,
    refresh,
    stopPolling,
    resumePolling
  };
}
