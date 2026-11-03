import { useCallback, useEffect, useState } from 'react';
import { getRoom, getRoomEvents, getRoomMe, heartbeat } from '../../api/room';
import { ApiUnauthorizedError } from '../../api/client';
import { appEnv } from '../../config/env';
import { mapApiParticipantsToParticipants } from '../../mappers/room';
import type { ApiRoomEvent } from '../../types/api';
import type { Participant, Screen } from '../../types/bubble';

const SESSION_EXPIRED_MESSAGE = '세션이 만료됐어요. 다시 입장해주세요.';

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

  const refresh = useCallback(async (refreshOptions?: { showRefreshing?: boolean }) => {
    if (!roomCode) return;

    try {
      if (refreshOptions?.showRefreshing) setIsRefreshing(true);
      setError(null);

      const [roomResponse, eventsResponse] = await Promise.all([
        getRoom(roomCode),
        getRoomEvents(roomCode)
      ]);

      if (!currentUserId) {
        const me = await getRoomMe(roomCode);
        setCurrentUserId(me.me.userId);
      }

      const nextParticipants = mapApiParticipantsToParticipants(roomResponse.participants);
      setParticipants(nextParticipants);
      setEvents(eventsResponse.events);
      setRoomStatus(roomResponse.room.status);
      setHostUserId(roomResponse.room.hostUserId);
      onParticipantsLoaded(nextParticipants);
      onEventsLoaded(eventsResponse.events);

      if (roomResponse.room.status === 'finished') onNavigate('recommendation');
    } catch (refreshError) {
      if (refreshError instanceof ApiUnauthorizedError) {
        onResetSession(SESSION_EXPIRED_MESSAGE);
        return;
      }
      setError(refreshError instanceof Error ? refreshError.message : '버블 필드 데이터를 불러오지 못했어요');
    } finally {
      setIsLoading(false);
      if (refreshOptions?.showRefreshing) setIsRefreshing(false);
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
    setIsLoading(true);
    void refresh();
    if (appEnv.demoMode) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, appEnv.fieldRoomPollingIntervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    if (appEnv.demoMode) return;

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
    refresh
  };
}
