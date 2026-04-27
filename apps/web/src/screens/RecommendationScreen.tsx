import { MessageCircle, Sparkles } from 'lucide-react';
import type { CommonInterest, Participant } from '../types/bubble';

function buildRecommendationLines(commonInterests: CommonInterest[], participants: Participant[], currentUserId: string) {
  const lines = commonInterests.flatMap((item) => item.icebreakers);

  if (lines.length > 0) {
    return Array.from(new Set(lines)).slice(0, 6);
  }

  const others = participants.filter((participant) => participant.id !== currentUserId);
  const interests = others.flatMap((participant) =>
    participant.interests
      .filter((interest) => interest.level !== 'deep3')
      .map((interest) => `${interest.text} 좋아하게 된 계기가 뭐예요?`)
  );

  return Array.from(new Set(interests)).slice(0, 6);
}

export default function RecommendationScreen({
  commonInterests,
  participants,
  currentUserId,
  onExit
}: {
  commonInterests: CommonInterest[];
  participants: Participant[];
  currentUserId: string;
  onExit: () => void;
}) {
  const lines = buildRecommendationLines(commonInterests, participants, currentUserId);

  return (
    <div className="min-h-screen px-5 py-8 bg-gradient-to-b from-purple-50 via-pink-50 to-white">
      <div className="max-w-[420px] mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bubble Breaking 완료</h2>
          <p className="text-sm text-gray-600">이제 자연스럽게 대화를 시작해보세요</p>
        </div>

        <div className="space-y-3 mb-8">
          {lines.map((line, index) => (
            <div
              key={`${line}-${index}`}
              className="bg-white rounded-3xl px-5 py-4 border border-purple-100 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-sm leading-relaxed text-gray-700">{line}</p>
              </div>
            </div>
          ))}

          {lines.length === 0 && (
            <div className="bg-white rounded-3xl px-5 py-6 border border-purple-100 shadow-sm text-center text-sm text-gray-500">
              추천 문장을 준비 중이에요. 방금 나온 공통 관심사를 바탕으로 편하게 말을 걸어보세요.
            </div>
          )}
        </div>

        <button
          onClick={onExit}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-full font-semibold shadow-lg shadow-purple-200/50 active:scale-95 transition-transform"
        >
          대화 시작하고 닫기
        </button>
      </div>
    </div>
  );
}
