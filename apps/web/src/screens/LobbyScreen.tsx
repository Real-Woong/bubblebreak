import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, LogOut, Users, ChevronRight, RefreshCw } from 'lucide-react';
import type { Screen } from '../types/bubble';
import { getRoom, getRoomMe, leaveRoom, readyRoom, startRoom } from '../api/room';
import { mapApiParticipantsToRoomSlots } from '../mappers/room';

// (Demo배포)
// 데모 배포에서는 자동 polling을 꺼서 request 수를 최소화합니다.
const DEMO_MODE = true;
const ROOM_POLLING_INTERVAL_MS = 5000;

export default function LobbyScreen({
  roomCode,
  currentUserId,
  setCurrentUserId,
  onNavigate,
  onResetSession
}: {
  roomCode: string;
  currentUserId: string;
  setCurrentUserId: (userId: string) => void;
  onNavigate: (screen: Screen) => void;
  onResetSession: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [roomStatus, setRoomStatus] = useState<string>('');
  const [hostUserId, setHostUserId] = useState('');
  const [slots, setSlots] = useState<ReturnType<typeof mapApiParticipantsToRoomSlots>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReadySubmitting, setIsReadySubmitting] = useState(false);
  const [isStartSubmitting, setIsStartSubmitting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchRoom = async (options?: { showRefreshing?: boolean }) => {
    if (!roomCode) return;

    try {
      if (options?.showRefreshing) {
        setIsRefreshing(true);
      }

      setError(null);

      if (!currentUserId) {
        const me = await getRoomMe(roomCode);
        setCurrentUserId(me.me.userId);
      }

      const response = await getRoom(roomCode);
      setRoomStatus(response.room.status);
      setHostUserId(response.room.hostUserId);
      setSlots(mapApiParticipantsToRoomSlots(response.participants));

      if (response.room.status === 'started') {
        onNavigate('field');
      }

      if (response.room.status === 'finished') {
        onNavigate('recommendation');
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '방 정보를 불러오지 못했어요');
    } finally {
      setIsLoading(false);
      if (options?.showRefreshing) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    setIsLoading(true);
    void fetchRoom();

    // (Demo배포)
    // !! polling 주의 !!
    // 데모 배포에서는 자동 polling을 꺼서 request 수를 최대한 아껴요.
    if (DEMO_MODE) {
      return;
    }

    // (정식배포)
    // 로비 화면이 열려 있는 동안만 주기적으로 room 상태를 다시 읽어요.
    // 무료 한도 절약을 위해 너무 짧지 않게 5초 간격으로 둡니다.
    const intervalId = window.setInterval(() => {
      void fetchRoom();
    }, ROOM_POLLING_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [roomCode, currentUserId]);

  const isHost = hostUserId === currentUserId;

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error('room code copy failed', copyError);
    }
  };

  const participantCount = slots.filter((slot) => slot.type === 'participant').length;
  const participantSlots = slots.filter((slot) => slot.type === 'participant');

  const canStart = participantSlots
    .filter((slot) => slot.participant.id !== currentUserId)
    .every((slot) => slot.status === 'ready');

  const isStartEnabled = isHost && participantCount >= 2 && roomStatus === 'waiting' && canStart;

  const amIReady = useMemo(
    () =>
      participantSlots.some(
        (slot) => slot.participant.id === currentUserId && slot.status === 'ready'
      ),
    [participantSlots, currentUserId]
  );

  const handleReady = async () => {
    if (!roomCode || isReadySubmitting || amIReady) return;

    try {
      setIsReadySubmitting(true);
      setError(null);
      await readyRoom(roomCode);
      await fetchRoom();
    } catch (readyError) {
      setError(readyError instanceof Error ? readyError.message : '준비완료 처리에 실패했어요');
    } finally {
      setIsReadySubmitting(false);
    }
  };

  const handleStart = async () => {
    if (!isStartEnabled || isStartSubmitting) return;

    try {
      setIsStartSubmitting(true);
      setError(null);
      await startRoom(roomCode);
      onNavigate('field');
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : '시작 처리에 실패했어요');
    } finally {
      setIsStartSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (isLeaving) return;

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
    <div className="min-h-screen px-5 pt-8 pb-8">
      <div className="max-w-[375px] mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">방 대기실</h2>
          <p className="text-sm text-gray-600">참여자들이 모이면 시작할 수 있어요</p>
          {roomStatus && (
            <p className="text-xs text-purple-500 mt-2">현재 방 상태: {roomStatus}</p>
          )}
        </div>

        {isLoading && (
          <div className="bg-white/80 rounded-2xl p-4 mb-4 text-center text-sm text-gray-500">
            방 정보를 불러오는 중...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-4 text-center text-sm text-red-500">
            {error}
          </div>
        )}

        {DEMO_MODE && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <p className="text-xs font-semibold text-amber-700 mb-2">
              데모 모드: 자동 새로고침이 꺼져 있어요
            </p>
            <button
              onClick={() => {
                void fetchRoom({ showRefreshing: true });
              }}
              disabled={isRefreshing}
              className="w-full bg-white text-amber-700 py-3 rounded-full font-medium text-sm border border-amber-200 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? '새로고침 중...' : '참여자 상태 수동 새로고침'}
            </button>
          </div>
        )}

        <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl p-6 mb-6 border-2 border-white shadow-lg">
          <div className="text-center mb-4">
            <p className="text-sm text-purple-700 font-medium mb-2">방 코드</p>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-4 inline-flex items-center gap-3">
              <span className="text-3xl font-bold tracking-wider text-purple-600">{roomCode}</span>
              <button
                onClick={copyRoomCode}
                className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <Copy className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-center text-purple-600">이 코드를 친구들에게 공유하세요</p>
        </div>

        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">참여자 ({participantCount}/6)</h3>
          <div className="grid grid-cols-2 gap-3">
            {slots.map((slot) => {
              if (slot.type === 'empty') {
                return (
                  <div
                    key={slot.id}
                    className="rounded-2xl p-4 border-2 bg-gray-50/50 border-gray-100 border-dashed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-gray-200 text-gray-400">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-400">빈 자리</p>
                      </div>
                    </div>
                  </div>
                );
              }

              const { participant, status } = slot;

              return (
                <div
                  key={slot.id}
                  className={`rounded-2xl p-4 border-2 ${
                    status === 'ready'
                      ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                      : 'bg-white/70 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white bg-gradient-to-br ${participant.color}`}
                    >
                      {participant.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-900">{participant.name}</p>

                      {status === 'ready' && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          <span className="text-xs text-green-600">준비완료</span>
                        </div>
                      )}

                      {status === 'waiting' && (
                        <span className="text-xs text-gray-500">대기중...</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {isHost ? (
            <button
              onClick={() => {
                void handleStart();
              }}
              disabled={!isStartEnabled || isStartSubmitting}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-full font-semibold shadow-lg shadow-purple-200/50 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isStartSubmitting ? '시작 중...' : 'BubbleBreaking 시작'}
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => {
                void handleReady();
              }}
              disabled={isReadySubmitting || amIReady}
              className="w-full bg-gradient-to-r from-green-400 to-emerald-500 text-white py-4 rounded-full font-semibold shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              {amIReady ? '준비완료됨' : isReadySubmitting ? '처리 중...' : '준비완료'}
            </button>
          )}

          <button
            onClick={() => onNavigate('setup')}
            className="w-full bg-white/80 backdrop-blur-sm text-purple-600 py-3.5 rounded-full font-medium text-sm border-2 border-purple-200 active:scale-95 transition-transform"
          >
            내 버블 수정
          </button>

          <button
            onClick={() => {
              void handleLeave();
            }}
            disabled={isLeaving}
            className="w-full bg-gray-900 text-white py-3.5 rounded-full font-medium text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {isLeaving ? '나가는 중...' : '방 나가기'}
          </button>
        </div>

        {isHost && !isStartEnabled && (
          <p className="text-xs text-center text-gray-500 mt-2">
            모든 참여자가 준비완료해야 시작할 수 있어요
          </p>
        )}

        <div className="mt-6 bg-purple-50/50 rounded-2xl p-4 border border-purple-100/50">
          <p className="text-xs text-gray-600 text-center leading-relaxed">
            💡 최소 2명 이상일 때 버블을 터뜨릴 수 있어요
          </p>
        </div>
      </div>
    </div>
  );
}
