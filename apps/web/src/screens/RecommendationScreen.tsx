import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import type { ApiRoomSummaryPair } from '../types/api';
import { getRoomSummary } from '../api/room';
import { ApiUnauthorizedError } from '../api/client';

const SESSION_EXPIRED_MESSAGE = '세션이 만료됐어요. 다시 입장해주세요.';

type MutualMatch = {
  id: string;
  userAName: string;
  userBName: string;
  interestText: string;
  icebreakers: string[];
};

type OneWayReveal = {
  id: string;
  sourceName: string;
  targetName: string;
  interestText: string | null;
};

function buildIcebreakers(text: string): string[] {
  return [
    `${text} 좋아하세요?`,
    `요즘 ${text} 관련해서 자주 하는 거 있어요?`,
    `${text}는 언제부터 관심 있었어요?`
  ];
}

function buildMatches(pairs: ApiRoomSummaryPair[]) {
  const mutualMatches: MutualMatch[] = [];
  const oneWayReveals: OneWayReveal[] = [];

  pairs.forEach((pair) => {
    pair.items.forEach((item, idx) => {
      if (item.kind === 'mutual') {
        if (!item.interestText) return;
        mutualMatches.push({
          id: `${pair.userAId}-${pair.userBId}-${idx}`,
          userAName: pair.userAName,
          userBName: pair.userBName,
          interestText: item.interestText,
          icebreakers: buildIcebreakers(item.interestText)
        });
        return;
      }

      const sourceName = item.sourceUserId === pair.userAId ? pair.userAName : pair.userBName;
      const targetName = item.targetUserId === pair.userAId ? pair.userAName : pair.userBName;

      oneWayReveals.push({
        id: `${pair.userAId}-${pair.userBId}-${idx}`,
        sourceName,
        targetName,
        interestText: item.interestText
      });
    });
  });

  return { mutualMatches, oneWayReveals };
}

export default function RecommendationScreen({
  roomCode,
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
    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await getRoomSummary(roomCode);
        if (!cancelled) {
          setPairs(response.pairs);
        }
      } catch (fetchError) {
        if (cancelled) return;
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
    };
  }, [roomCode, onExit]);

  const { mutualMatches, oneWayReveals } = useMemo(() => buildMatches(pairs), [pairs]);

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
            {mutualMatches.map((match) => (
              <div
                key={match.id}
                className="bg-white rounded-3xl p-5 shadow-sm border-2 border-purple-100"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold z-10">
                      {match.userAName.charAt(0).toUpperCase()}
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center text-white font-semibold -ml-3">
                      {match.userBName.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <div className="flex-1">
                    <p className="text-sm text-gray-600">
                      {match.userAName} + {match.userBName}
                    </p>
                    <p className="font-bold text-purple-600 text-lg">{match.interestText}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium mb-2">💬 대화 시작하기</p>
                  {match.icebreakers.map((icebreaker, idx) => (
                    <button
                      key={`${match.id}-${idx}`}
                      className="w-full bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 text-gray-700 px-4 py-3 rounded-2xl text-sm text-left border border-purple-100 active:scale-98 transition-all"
                    >
                      {icebreaker}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {mutualMatches.length === 0 && (
              <div className="bg-white rounded-3xl px-5 py-6 border border-purple-100 shadow-sm text-center text-sm text-gray-500">
                이번 방에서는 서로 같은 관심사를 확인한 기록이 없어요.
              </div>
            )}

            {oneWayReveals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 px-1">그 외 있었던 반응들</p>
                {oneWayReveals.map((reveal) => (
                  <div
                    key={reveal.id}
                    className="bg-white rounded-3xl px-5 py-4 border border-purple-100 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="text-sm leading-relaxed text-gray-700">
                        {reveal.interestText
                          ? `${reveal.sourceName}가 ${reveal.targetName}의 '${reveal.interestText}'를 확인했어요`
                          : `${reveal.sourceName}가 ${reveal.targetName}의 비공개 관심사를 확인했어요`}
                      </p>
                    </div>
                  </div>
                ))}
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
