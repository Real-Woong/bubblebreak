import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Sparkles, Users } from 'lucide-react';
import type { ApiRoomSummaryItem, ApiRoomSummaryPair } from '../types/api';
import { getRoomSummary } from '../api/room';
import { ApiUnauthorizedError } from '../api/client';

const SESSION_EXPIRED_MESSAGE = '세션이 만료됐어요. 다시 입장해주세요.';

function buildIcebreakers(text: string): string[] {
  return [
    `${text} 좋아하세요?`,
    `요즘 ${text} 관련해서 자주 하는 거 있어요?`,
    `${text}는 언제부터 관심 있었어요?`
  ];
}

function itemLabel(item: ApiRoomSummaryItem, pair: ApiRoomSummaryPair) {
  if (item.kind === 'mutual') {
    return item.interestText
      ? `둘 다 '${item.interestText}'에 흥미가 있어요`
      : '둘 다 비공개 관심사를 확인했어요';
  }

  const sourceName = item.sourceUserId === pair.userAId ? pair.userAName : pair.userBName;
  const targetName = item.targetUserId === pair.userAId ? pair.userAName : pair.userBName;

  return item.interestText
    ? `${sourceName}가 ${targetName}의 '${item.interestText}'를 확인했어요`
    : `${sourceName}가 ${targetName}의 비공개 관심사를 확인했어요`;
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

  const sortedPairs = useMemo(() => {
    const involvesMe = (pair: ApiRoomSummaryPair) =>
      pair.userAId === currentUserId || pair.userBId === currentUserId;

    return [...pairs].sort((a, b) => Number(involvesMe(b)) - Number(involvesMe(a)));
  }, [pairs, currentUserId]);

  const icebreakerLines = useMemo(() => {
    const lines = pairs.flatMap((pair) =>
      pair.items
        .filter((item) => item.kind === 'mutual' && item.interestText)
        .flatMap((item) => buildIcebreakers((item as { interestText: string }).interestText))
    );

    return Array.from(new Set(lines)).slice(0, 6);
  }, [pairs]);

  return (
    <div className="min-h-screen px-5 py-8 bg-gradient-to-b from-purple-50 via-pink-50 to-white">
      <div className="max-w-[420px] mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bubble Breaking 완료</h2>
          <p className="text-sm text-gray-600">이 방에서 있었던 관심사 매칭이에요</p>
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
          <div className="space-y-3 mb-8">
            {sortedPairs.map((pair) => (
              <div
                key={`${pair.userAId}-${pair.userBId}`}
                className="bg-white rounded-3xl px-5 py-4 border border-purple-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-purple-500" />
                  <p className="text-sm font-semibold text-gray-900">
                    {pair.userAName} ↔ {pair.userBName}
                  </p>
                </div>

                <div className="space-y-2">
                  {pair.items.map((item, idx) => (
                    <div
                      key={`${pair.userAId}-${pair.userBId}-${idx}`}
                      className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${
                        item.kind === 'mutual'
                          ? 'bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          item.kind === 'mutual' ? 'bg-purple-100' : 'bg-gray-100'
                        }`}
                      >
                        <MessageCircle
                          className={`w-4 h-4 ${item.kind === 'mutual' ? 'text-purple-600' : 'text-gray-500'}`}
                        />
                      </div>
                      <p
                        className={`text-sm leading-relaxed ${
                          item.kind === 'mutual' ? 'text-purple-700 font-medium' : 'text-gray-600'
                        }`}
                      >
                        {itemLabel(item, pair)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {sortedPairs.length === 0 && (
              <div className="bg-white rounded-3xl px-5 py-6 border border-purple-100 shadow-sm text-center text-sm text-gray-500">
                이번 방에서는 서로 버블을 확인한 기록이 없어요.
              </div>
            )}
          </div>
        )}

        {icebreakerLines.length > 0 && (
          <div className="space-y-3 mb-8">
            <p className="text-xs font-semibold text-gray-500 px-1">💬 대화 시작 문장 추천</p>
            {icebreakerLines.map((line, index) => (
              <div
                key={`${line}-${index}`}
                className="bg-white rounded-3xl px-5 py-4 border border-purple-100 shadow-sm"
              >
                <p className="text-sm leading-relaxed text-gray-700">{line}</p>
              </div>
            ))}
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
