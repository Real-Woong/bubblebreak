import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Link2, LogOut, Share2, Users, ChevronRight, RefreshCw } from 'lucide-react';
import { appEnv } from '../config/env';
import type { Screen } from '../types/bubble';
import { getRoom, getRoomMe, leaveRoom, readyRoom, startRoom } from '../api/room';
import { ApiUnauthorizedError } from '../api/client';
import { isAbortError, isSessionGoneError, sessionGoneMessage } from '../api/errors';
import { buildInviteLink } from '../lib/roomCode';
import { mapApiParticipantsToRoomSlots } from '../mappers/room';

const SESSION_EXPIRED_MESSAGE = '세션이 만료됐어요. 다시 입장해주세요.';

// (Demo배포)
// 데모 배포에서는 자동 polling을 꺼서 request 수를 최소화합니다.
const DEMO_MODE = appEnv.demoMode;
const ROOM_POLLING_INTERVAL_MS = appEnv.lobbyRoomPollingIntervalMs;

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
  onResetSession: (message?: string) => void;
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
  const [linkCopied, setLinkCopied] = useState(false);

  // 폴링/조회의 수명을 관리하는 컨트롤러.
  // 나가기 · 언마운트 · 세션 정리 시 abort해서 in-flight 응답이 화면 전환을 일으키지 못하게 한다.
  const controllerRef = useRef<AbortController | null>(null);
  // 나가기 실패 후 폴링을 다시 켤 때 effect를 재실행하기 위한 카운터
  const [pollEpoch, setPollEpoch] = useState(0);

  const fetchRoom = async (options?: { showRefreshing?: boolean }) => {
    const signal = controllerRef.current?.signal;
    if (!roomCode || !signal || signal.aborted) return;

    try {
      if (options?.showRefreshing) {
        setIsRefreshing(true);
      }

      setError(null);

      if (!currentUserId) {
        const me = await getRoomMe(roomCode, { signal });
        if (signal.aborted) return;
        setCurrentUserId(me.me.userId);
      }

      const response = await getRoom(roomCode, { signal });
      if (signal.aborted) return;
      setRoomStatus(response.room.status);
      setHostUserId(response.room.hostUserId);
      setSlots(mapApiParticipantsToRoomSlots(response.participants));

      if (response.room.status === 'started') {
        onNavigate('field');
      }

      // 대기실에서 버블 브레이킹 없이 방이 끝난 경우(방장이 나감 등)에는 완료 화면이 아니라 홈으로 보낸다.
      if (response.room.status === 'finished') {
        controllerRef.current?.abort();
        onResetSession('방이 종료되었어요.');
      }
    } catch (fetchError) {
      if (signal.aborted || isAbortError(fetchError)) return;
      if (isSessionGoneError(fetchError)) {
        // 404/401/403: 폴링을 멈추고 세션을 정리한다.
        controllerRef.current?.abort();
        onResetSession(sessionGoneMessage(fetchError));
        return;
      }
      setError(fetchError instanceof Error ? fetchError.message : '방 정보를 불러오지 못했어요');
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
        if (options?.showRefreshing) {
          setIsRefreshing(false);
        }
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    void fetchRoom();

    // (Demo배포)
    // !! polling 주의 !!
    // 데모 배포에서는 자동 polling을 꺼서 request 수를 최대한 아껴요.
    if (DEMO_MODE) {
      return () => controller.abort();
    }

    // (정식배포)
    // 로비 화면이 열려 있는 동안만 주기적으로 room 상태를 다시 읽어요.
    // 무료 한도 절약을 위해 너무 짧지 않게 5초 간격으로 둡니다.
    const intervalId = window.setInterval(() => {
      void fetchRoom();
    }, ROOM_POLLING_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [roomCode, currentUserId, pollEpoch]);

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

  const inviteLink = buildInviteLink(window.location.origin, roomCode);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (copyError) {
      console.error('invite link copy failed', copyError);
      setError('링크를 복사하지 못했어요. 주소를 직접 공유해주세요.');
    }
  };

  const shareInviteLink = async () => {
    try {
      await navigator.share({ title: 'BubbleBreak 초대', text: `방 코드 ${roomCode}`, url: inviteLink });
    } catch (shareError) {
      // 사용자가 공유창을 닫은 경우(AbortError)는 무시
      if (isAbortError(shareError)) return;
      void copyInviteLink();
    }
  };

  const participantCount = slots.filter((slot) => slot.type === 'participant').length;
  const participantSlots = slots.filter((slot) => slot.type === 'participant');

  const canStart = participantSlots
    .filter((slot) => slot.participant.id !== currentUserId)
    .every((slot) => slot.status === 'ready');

  const pendingParticipants = participantSlots.filter(
    (slot) => slot.participant.id !== currentUserId && slot.status !== 'ready'
  );
  const pendingParticipantNames = pendingParticipants.map((slot) => slot.participant.name).join(', ');

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
      if (readyError instanceof ApiUnauthorizedError) {
        onResetSession(SESSION_EXPIRED_MESSAGE);
        return;
      }
      setError(readyError instanceof Error ? readyError.message : '준비완료 처리에 실패했어요');
    } finally {
      setIsReadySubmitting(false);
    }
  };

  const handleParticipantPrimaryAction = async () => {
    if (roomStatus === 'started') {
      onNavigate('field');
      return;
    }

    if (amIReady) {
      await fetchRoom({ showRefreshing: true });
      return;
    }

    await handleReady();
  };

  const handleStart = async () => {
    if (!isStartEnabled || isStartSubmitting) return;

    try {
      setIsStartSubmitting(true);
      setError(null);
      await startRoom(roomCode);
      onNavigate('field');
    } catch (startError) {
      if (startError instanceof ApiUnauthorizedError) {
        onResetSession(SESSION_EXPIRED_MESSAGE);
        return;
      }
      setError(startError instanceof Error ? startError.message : '시작 처리에 실패했어요');
    } finally {
      setIsStartSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (isLeaving) return;

    // 1) 폴링을 먼저 중단하고 in-flight 응답은 무시한다.
    controllerRef.current?.abort();

    try {
      setIsLeaving(true);
      await leaveRoom(roomCode);
      // 2) 세션을 정리하고 홈으로 이동한다.
      onResetSession();
    } catch (leaveError) {
      if (isSessionGoneError(leaveError)) {
        onResetSession();
        return;
      }
      // 나가기에 실패했으니 폴링을 다시 켠다.
      setPollEpoch((epoch) => epoch + 1);
      setError(leaveError instanceof Error ? leaveError.message : '방 나가기에 실패했어요');
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <div className="min-h-screen px-5 pt-8 pb-8">
      <div className="max-w-[375px] mx-auto">
        {/* 방을 나가면서(=leaveRoom 호출) entry로 돌아가는, "뒤로가기" 역할의 버튼 */}
        <button
          onClick={() => {
            void handleLeave();
          }}
          disabled={isLeaving}
          aria-label="뒤로가기"
          className="w-9 h-9 mb-4 bg-white/70 backdrop-blur-sm rounded-full border border-purple-100/50 shadow-sm flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">방 대기실</h2>
          <p className="text-sm text-gray-600">참여자들이 모이면 시작할 수 있어요</p>
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
                aria-label={copied ? '방 코드 복사됨' : '방 코드 복사'}
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
          <p className="text-xs text-center text-purple-600 mb-4">이 코드를 친구들에게 공유하세요</p>

          <div className="flex gap-2">
            <button
              onClick={() => {
                void copyInviteLink();
              }}
              className="flex-1 bg-white/90 text-purple-700 py-2.5 rounded-full text-sm font-semibold border border-purple-200 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            >
              {linkCopied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {linkCopied ? '링크 복사됨' : '초대 링크 복사'}
            </button>
            {canShare && (
              <button
                onClick={() => {
                  void shareInviteLink();
                }}
                aria-label="초대 링크 공유"
                className="px-4 bg-white/90 text-purple-700 rounded-full border border-purple-200 flex items-center justify-center active:scale-95 transition-transform"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </div>
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
              const isParticipantHost = participant.id === hostUserId;

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
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate text-gray-900">{participant.name}</p>
                        {isParticipantHost && (
                          <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600">
                            방장
                          </span>
                        )}
                      </div>

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
                void handleParticipantPrimaryAction();
              }}
              disabled={isReadySubmitting || isRefreshing}
              className="w-full bg-gradient-to-r from-green-400 to-emerald-500 text-white py-4 rounded-full font-semibold shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              {roomStatus === 'started'
                ? 'BubbleField 입장'
                : amIReady
                  ? isRefreshing
                    ? '시작 확인 중...'
                    : '시작 상태 확인'
                  : isReadySubmitting
                    ? '처리 중...'
                    : '준비완료'}
            </button>
          )}

          <div className="rounded-2xl border border-purple-100/70 bg-white/70 p-4 text-center">
            <p className="text-sm font-semibold text-gray-800">
              {isHost
                ? isStartEnabled
                  ? '이제 시작할 수 있어요'
                  : participantCount < 2
                    ? '최소 2명이 모이면 시작할 수 있어요'
                    : '모든 참여자가 준비완료해야 시작할 수 있어요'
                : amIReady
                  ? '방장이 시작하면 바로 입장할 수 있어요'
                  : '준비가 끝나면 준비완료를 눌러주세요'}
            </p>
            {isHost && pendingParticipantNames && (
              <p className="mt-1 text-xs text-gray-500">대기 중: {pendingParticipantNames}</p>
            )}
          </div>

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
            className="w-full bg-white text-red-700 py-3.5 rounded-full font-semibold text-sm border-2 border-red-300 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
          >
            <LogOut className="w-4 h-4" />
            {isLeaving ? '나가는 중...' : '방 나가기'}
          </button>
        </div>

      </div>
    </div>
  );
}
