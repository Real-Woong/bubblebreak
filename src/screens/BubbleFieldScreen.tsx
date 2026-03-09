import { useState } from 'react';
import { Users, Sparkles, CheckCircle, Lock } from 'lucide-react';
import type { Interest, Participant } from '../types/bubble';
import BubbleField from '../components/BubbleField';

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

  const participants: Participant[] = [
    { id: 'me', name: '나', color: 'from-purple-400 to-pink-400', interests: myInterests },
    {
      id: 'user2',
      name: 'user2',
      color: 'from-blue-400 to-cyan-400',
      interests: [
        { id: '1', text: '리그오브레전드', level: 'deep1' },
        { id: '2', text: '혼자 여행', level: 'deep2' },
        { id: '3', text: 'MBTI 집착', level: 'deep3' }
      ]
    },
    {
      id: 'user3',
      name: 'user3',
      color: 'from-green-400 to-emerald-400',
      interests: [
        { id: '4', text: '카페 탐방', level: 'deep1' },
        { id: '5', text: '아이돌 덕질', level: 'deep2' }
      ]
    }
  ];

  const handleBubbleTap = (interest: Interest, participantId: string) => {
    if (participantId === 'me') return;
    setSelectedBubble(interest);
    setShowPopConfirm(true);
  };

  const handlePop = () => {
    setShowPopConfirm(false);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
      setSelectedBubble(null);
    }, 3000);
  };

  return (
    <div className="min-h-screen pb-20 relative">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-purple-100 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">버블 필드</h3>
            <p className="text-xs text-gray-500">버블을 눌러 관심사를 확인하세요</p>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-600">{participants.length}</span>
          </div>
        </div>
      </div>

      {/* Bubble Field */}
      <div className="px-5 pt-6 pb-8">
        <div className="space-y-8">
          {participants.map((participant) => (
            <div key={participant.id} className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${participant.color} rounded-full flex items-center justify-center text-white font-semibold shadow-md`}>
                  {participant.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{participant.name}</p>
                  <p className="text-xs text-gray-500">{participant.interests.length}개의 버블</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50/30 to-pink-50/30 rounded-3xl p-6 border border-purple-100/30 min-h-[120px] relative overflow-hidden">
                <div className="flex flex-wrap gap-3">
                  {participant.interests.map((interest, iIdx) => (
                    <BubbleField
                      key={interest.id}
                      interest={interest}
                      participantId={participant.id}
                      participantColor={participant.color}
                      index={iIdx}
                      onTap={handleBubbleTap}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Common Ground FAB */}
      <button
        onClick={onShowCommonGround}
        className="fixed bottom-6 right-5 w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-xl shadow-purple-300/50 flex items-center justify-center active:scale-95 transition-transform z-20"
      >
        <Sparkles className="w-6 h-6 text-white" />
      </button>

      {/* Toast Notification */}
      {showNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-top duration-300">
          <div className="bg-purple-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">user2가 당신의 관심사를 확인했어요!</span>
          </div>
        </div>
      )}

      {/* Pop Confirmation Bottom Sheet */}
      {showPopConfirm && selectedBubble && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-end" onClick={() => setShowPopConfirm(false)}>
          <div
            className="bg-white rounded-t-3xl w-full p-6 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <h3 className="font-bold text-gray-900 text-lg mb-2">버블을 터뜨릴까요?</h3>
              <p className="text-sm text-gray-600">
                {selectedBubble.level === 'deep3' ? '상대방에게 요청을 보내요' : '관심사가 상대방에게 공개돼요'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2">
                {selectedBubble.level === 'deep3' && <Lock className="w-5 h-5 text-purple-500" />}
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
