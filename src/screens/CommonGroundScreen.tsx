import { X, Sparkles } from 'lucide-react';

export default function CommonGroundScreen({ onClose }: { onClose: () => void }) {
  const commonInterests = [
    {
      id: '1',
      interest: '리그오브레전드',
      withUser: 'user2',
      icebreakers: ['어느 라인 하세요?', '요즘도 자주 하세요?', '티어 어디까지 찍으셨어요?']
    },
    {
      id: '2',
      interest: '카페 탐방',
      withUser: 'user3',
      icebreakers: ['어디 카페 좋아하세요?', '홈카페 하세요?', '커피 취향이 어떻게 되세요?']
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-gradient-to-b from-purple-50 to-white rounded-t-3xl w-full max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-purple-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">공통 관심사</h3>
            <p className="text-xs text-gray-600">대화를 시작해보세요</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-6 space-y-4">
          {commonInterests.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl p-5 shadow-sm border-2 border-purple-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold z-10">
                    나
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center text-white font-semibold -ml-3">
                    {item.withUser.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">YOU + {item.withUser}</p>
                  <p className="font-bold text-purple-600 text-lg">{item.interest}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium mb-2">💬 대화 시작하기</p>
                {item.icebreakers.map((icebreaker, idx) => (
                  <button
                    key={idx}
                    className="w-full bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 text-gray-700 px-4 py-3 rounded-2xl text-sm text-left border border-purple-100 active:scale-98 transition-all"
                  >
                    {icebreaker}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {commonInterests.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">아직 공통 관심사가 발견되지 않았어요</p>
              <p className="text-gray-400 text-xs mt-1">더 많은 버블을 터뜨려보세요!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
