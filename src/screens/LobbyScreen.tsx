import { useState } from 'react';
import { Copy, Check, Users, ChevronRight } from 'lucide-react';
import type { Screen, RoomSlot } from '../types/bubble';

export default function LobbyScreen({
  roomCode,
  slots,
  onNavigate
}: {
  roomCode: string;
  slots: RoomSlot[];
  onNavigate: (screen: Screen) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('room code copy failed', error);
    }
  };

  const participantCount = slots.filter((slot) => slot.type === 'participant').length;

  return (
    <div className="min-h-screen px-5 pt-8 pb-8">
      <div className="max-w-[375px] mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">방 대기실</h2>
          <p className="text-sm text-gray-600">참여자들이 모이면 시작할 수 있어요</p>
        </div>

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
          <button
            onClick={() => onNavigate('field')}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-full font-semibold shadow-lg shadow-purple-200/50 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            방 들어가기
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => onNavigate('setup')}
            className="w-full bg-white/80 backdrop-blur-sm text-purple-600 py-3.5 rounded-full font-medium text-sm border-2 border-purple-200 active:scale-95 transition-transform"
          >
            내 버블 수정
          </button>
        </div>

        <div className="mt-6 bg-purple-50/50 rounded-2xl p-4 border border-purple-100/50">
          <p className="text-xs text-gray-600 text-center leading-relaxed">
            💡 최소 2명 이상일 때 버블을 터뜨릴 수 있어요
          </p>
        </div>
      </div>
    </div>
  );
}