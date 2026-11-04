import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { ApiRoomSummaryPair } from '../types/api';
import { getRoomSummary } from '../api/room';
import { ApiUnauthorizedError } from '../api/client';
import { isAbortError } from '../api/errors';

const SESSION_EXPIRED_MESSAGE = '세션이 만료됐어요. 다시 입장해주세요.';

type MutualMatch = {
  id: string;
  // 나와 같은 관심사를 가진 상대
  partnerName: string;
  interestText: string;
  icebreakers: string[];
};

function buildIcebreakers(text: string): string[] {
  return [
    `${text} 좋아하세요?`,
    `요즘 ${text} 관련해서 자주 하는 거 있어요?`,
    `${text}는 언제부터 관심 있었어요?`
  ];
}

// 마무리 화면은 "나와 관심사가 같은 사람"만 보여준다.
// - 내가 속하지 않은 쌍(다른 사람들끼리의 매칭)은 제외
// - 한쪽만 확인한 반응(oneWay)은 노출하지 않는다 (누가 내 버블을 봤는지 알려주지 않음)
function buildMyMatches(pairs: ApiRoomSummaryPair[], currentUserId: string): MutualMatch[] {
  const matches: MutualMatch[] = [];

  pairs.forEach((pair) => {
    const isA = pair.userAId === currentUserId;
    const isB = pair.userBId === currentUserId;
    if (!isA && !isB) return;

    const partnerName = isA ? pair.userBName : pair.userAName;

    pair.items.forEach((item, idx) => {
      if (item.kind !== 'mutual' || !item.interestText) return;
      matches.push({
        id: `${pair.userAId}-${pair.userBId}-${idx}`,
        partnerName,
        interestText: item.interestText,
        icebreakers: buildIcebreakers(item.interestText)
      });
    });
  });

  return matches;
}

export default function RecommendationScreen({
  roomCode,
  currentUserId,
  onExit
}: {
  roomCode: string;
  currentUserId: string;
  onExit: (message?: string) => void;
}) {
  const [pairs, setPairs] = useState<ApiRoomSummaryPair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // roomCode가 비어 있으면 /rooms//summary 같은 요청을 보내지 않고 홈으로 돌려보낸다.
    if (!roomCode.trim()) {
      onExit();
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await getRoomSummary(roomCode, { signal: controller.signal });
        if (!cancelled) {
          setPairs(response.pairs);
        }
      } catch (fetchError) {
        if (cancelled || isAbortError(fetchError)) return;
        if (fetchError instanceof ApiUnauthorizedError) {
          onExit(SESSION_EXPIRED_MESSAGE);
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : '요약 정보를 불러오지 못했어요');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [roomCode, onExit]);

  const myMatches = useMemo(() => buildMyMatches(pairs, currentUserId), [pairs, currentUserId]);

  return (
    <div className="min-h-screen px-5 py-8 bg-gradient-to-b from-purple-50 via-pink-50 to-white">
      <div className="max-w-[375px] mx-auto">
        <button
          onClick={() => onExit()}
          aria-label="뒤로가기"
          className="w-9 h-9 mb-4 bg-white/80 backdrop-blur-sm rounded-full border border-purple-100 shadow-sm flex items-center justify-center active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bubble Breaking 완료</h2>
          <p className="text-sm text-gray-600">이제 자연스럽게 대화를 시작해보세요</p>
        </div>

        {isLoading && (
          <div className="bg-white rounded-3xl px-5 py-6 border border-purple-100 shadow-sm text-center text-sm text-gray-500 mb-6">
            요약을 불러오는 중...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 text-center text-sm text-red-500">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <div className="space-y-4 mb-8">
            {myMatches.map((match) => (
              <div
                key={match.id}
                className="bg-white rounded-3xl p-5 shadow-sm border-2 border-purple-100"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold shrink-0">
                    {match.partnerName.charAt(0).toUpperCase()}
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-semibold">{match.partnerName}</span>님도{' '}
                    <span className="font-bold text-purple-700">{match.interestText}</span>에 관심이 있어요
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-gray-600 font-medium mb-2">💬 대화 시작하기</p>
                  {match.icebreakers.map((icebreaker, idx) => (
                    <div
                      key={`${match.id}-${idx}`}
                      className="w-full bg-gradient-to-r from-purple-50 to-pink-50 text-gray-700 px-4 py-3 rounded-2xl text-sm text-left border border-purple-100"
                    >
                      {icebreaker}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {myMatches.length === 0 && (
              <div className="bg-white rounded-3xl px-5 py-6 border border-purple-100 shadow-sm text-center text-sm text-gray-600">
                이번에는 나와 같은 관심사를 서로 확인한 사람이 없어요.
                <br />
                직접 말을 걸어 새로운 공통점을 찾아보세요!
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => onExit()}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-full font-semibold shadow-lg shadow-purple-200/50 active:scale-95 transition-transform"
        >
          대화 시작하고 닫기
        </button>
      </div>
    </div>
  );
}
