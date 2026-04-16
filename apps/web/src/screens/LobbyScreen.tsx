import { useState } from 'react';
import { Copy, Check, Users, ChevronRight } from 'lucide-react';
import type { Screen, RoomSlot } from '../types/bubble';

// LobbyScreen
// 이 화면은 "방 대기실" 역할을 한다.
//
// 역할:
// 1. 현재 방 코드 공유
// 2. 참가자 목록 표시 (누가 들어왔는지)
// 3. 각 참가자의 준비 상태 표시
// 4. host / participant 역할에 따라 버튼 분기
//    - participant → 준비완료 버튼
//    - host → BubbleBreaking 시작 버튼
//
// 중요한 구조:
// - participant 정보는 slot 안에 들어있고
// - 준비 상태(status)는 slot에 존재한다
//   → 즉 "상태는 participant가 아니라 slot 기준"으로 본다
//
// 현재 상태:
// - slots(RoomSlot[])은 App.tsx에서 내려주는 임시(mock) 데이터
//
// TODO (API 연결 시):
// - GET /rooms/:code 로 room + room_participants 조회
// - room_participants → 화면용 Participant/Slot 형태로 매핑
// - 이 컴포넌트 내부에서 useEffect로 fetch 후 local state로 관리

// TODO (API 전환 설계)
// 이후에는 아래 props 중 slots를 제거하고,
// roomCode만 받아서 내부에서 fetch 하는 구조로 전환할 예정
// 예:
// useEffect(() => {
//   // GET /rooms/:code
//   // setParticipantsFromApi(...)
// }, [roomCode]);

export default function LobbyScreen({
  roomCode,
  slots,
  currentUserId,
  isHost,
  onNavigate
}: {
  roomCode: string;
  slots: RoomSlot[];
  currentUserId: string;
  isHost: boolean;
  onNavigate: (screen: Screen) => void;
}) {
  // 방 코드 복사 버튼 상태
  // 클릭 시 2초 동안 체크 아이콘으로 변경
  const [copied, setCopied] = useState(false);

  // 방 코드를 클립보드에 복사하는 함수
  // 복사 성공 시 copied 상태를 true로 바꿔 UI 피드백 제공
  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('room code copy failed', error);
    }
  };

  // 현재 방에 참가한 인원 수 계산 (empty 제외)
  // NOTE: 지금은 slots(mock) 기준으로 계산
  // TODO: API 연결 후에는 room_participants.length 기준으로 계산
  const participantCount = slots.filter((slot) => slot.type === 'participant').length;

  // participant 목록을 slot 기준으로 유지
  // 이유:
  // - participant 객체에는 status가 없음
  // - status는 slot에 존재함
  // NOTE: 현재는 mock slots 구조를 사용 중
  // TODO: API 연결 후에는 room_participants의 is_ready 필드를 사용하여 상태 계산
  const participantSlots = slots.filter((slot) => slot.type === 'participant');

  // host가 게임을 시작할 수 있는 조건
  // - 자기 자신(currentUserId)은 제외
  // - 나머지 모든 participant가 ready 상태여야 함
  // NOTE: 현재는 slot.status로 판단
  // TODO: API 연결 후에는 participant.is_ready (DB: room_participants.is_ready) 기준으로 판단
  const canStart = participantSlots
    .filter((slot) => slot.participant.id !== currentUserId)
    .every((slot) => slot.status === 'ready');

  // -----------------------------
  // UI 렌더링 시작
  // -----------------------------
  return (
    <div className="min-h-screen px-5 pt-8 pb-8">
      <div className="max-w-[375px] mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">방 대기실</h2>
          <p className="text-sm text-gray-600">참여자들이 모이면 시작할 수 있어요</p>
        </div>

        {/* 방 코드 영역
            - 현재 방 코드 표시
            - 버튼 클릭 시 클립보드 복사 */}
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

        {/* 참가자 목록 영역
            - 최대 6명
            - empty slot은 빈 자리로 표시
            - participant는 상태(ready/waiting)에 따라 스타일 변경 */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">참여자 ({participantCount}/6)</h3>

          {/* TODO (API 연결 시)
              - 현재는 slots 배열을 직접 map
              - 이후에는 room_participants 응답을 기반으로 slots/participants를 생성하거나
                또는 slots 개념 없이 participants 리스트로 바로 렌더링 */}
          <div className="grid grid-cols-2 gap-3">
            {slots.map((slot) => {
              // 빈 자리 UI
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

              // 실제 참가자 UI
              // status에 따라 배경 / 상태 텍스트가 달라짐
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

        {/* 하단 액션 버튼 영역
            - host / participant에 따라 다른 버튼 노출 */}
        <div className="space-y-3">
          {/* host일 경우
              - 모든 participant가 ready일 때만 활성화 */}
          {isHost ? (
            <button
              onClick={() => {
                if (!canStart) return;

                // TODO: POST /rooms/:code/start
                // body: { userId: currentUserId }
                // 서버에서 room.status를 'started'로 변경
                onNavigate('field');
              }}
              disabled={!canStart}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-full font-semibold shadow-lg shadow-purple-200/50 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              BubbleBreaking 시작
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            /* participant일 경우
                - 준비완료 버튼 제공 */
            <button
              onClick={() => {
                // TODO: POST /rooms/:code/ready
                // body: { userId: currentUserId }
                // 서버에서 room_participants.is_ready = 1 업데이트
              }}
              className="w-full bg-gradient-to-r from-green-400 to-emerald-500 text-white py-4 rounded-full font-semibold shadow-lg active:scale-95 transition-transform"
            >
              준비완료
            </button>
          )}

          {/* SetupScreen으로 돌아가서 관심사 수정 */}
          <button
            onClick={() => onNavigate('setup')}
            className="w-full bg-white/80 backdrop-blur-sm text-purple-600 py-3.5 rounded-full font-medium text-sm border-2 border-purple-200 active:scale-95 transition-transform"
          >
            내 버블 수정
          </button>
        </div>

        {/* host가 시작 못하는 이유 안내 메시지 */}
        {isHost && !canStart && (
          <p className="text-xs text-center text-gray-500 mt-2">
            모든 참여자가 준비완료해야 시작할 수 있어요
          </p>
        )}

        {/* 하단 안내 메시지
            - 최소 인원 조건 안내 */}
        <div className="mt-6 bg-purple-50/50 rounded-2xl p-4 border border-purple-100/50">
          <p className="text-xs text-gray-600 text-center leading-relaxed">
            💡 최소 2명 이상일 때 버블을 터뜨릴 수 있어요
          </p>
        </div>

        {/*
          ============================================================
          API 연결 예정 위치 (Lobby)

          useEffect(() => {
            // 1. GET /rooms/:code
            //    → room, room_participants 응답 수신

            // 2. room_participants → 화면용 데이터로 변환
            //    {
            //      id,
            //      nickname,
            //      is_ready,
            //      is_host
            //    }

            // 3. setParticipants(...) 또는 setSlots(...)로 상태 업데이트
          }, [roomCode]);

          ============================================================
        */}
      </div>
    </div>
  );
}