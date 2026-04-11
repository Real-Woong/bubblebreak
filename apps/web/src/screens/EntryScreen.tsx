import { useLayoutEffect, useRef, useState } from 'react';
import type { Screen } from '../types/bubble';
import { Sparkles, Users } from 'lucide-react';
import BubbleBreakLogo from '../components/image/logo/BubbleBreakLogo.png';

export default function EntryScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [heroWidth, setHeroWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      if (!titleRef.current) return;
      const w = Math.ceil(titleRef.current.getBoundingClientRect().width);
      setHeroWidth(w);
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="min-h-screen px-5 pt-10 pb-8 flex">
      <div className="max-w-[375px] w-full mx-auto flex flex-col flex-1">
        <div className="flex-1 flex flex-col justify-center">
          {/* Header */}
          <div className="text-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="overflow-hidden flex items-center justify-center"
              style={heroWidth ? { width: heroWidth, height: heroWidth } : undefined}
            >
              <img
                src={BubbleBreakLogo}
                alt="BubbleBreak logo"
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>

            <h1
              ref={titleRef}
              className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent"
            >
              BubbleBreak
            </h1>

            <div className="space-y-1">
              <p className="text-base text-gray-700 leading-relaxed">관심사로 자연스럽게 대화 시작하기</p>
              <p className="text-sm text-gray-500">낯설지 않게, 부담 없이</p>
            </div>
          </div>
        </div>

        {/* Value props */}
        <div className="space-y-3 mt-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 border border-purple-100/50 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">3단계 관심사 시스템</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  공개부터 비공개까지, 내가 선택하는 깊이
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 border border-purple-100/50 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">최대 6명의 소규모 룸</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  부담 없는 인원, 편안한 분위기
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <button
            onClick={() => onNavigate('setup')}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-full font-semibold text-base shadow-lg shadow-purple-200/50 active:scale-95 transition-transform"
          >
            방 만들기
          </button>

          <button
            onClick={() => onNavigate('lobby')}
            className="w-full bg-white/80 backdrop-blur-sm text-purple-600 py-4 rounded-full font-semibold text-base border-2 border-purple-200 active:scale-95 transition-transform"
          >
            방 참여하기
          </button>

          <p className="text-center text-xs text-gray-500 pt-2">💾 계정 없이, 쿠키로 저장돼요</p>
        </div>
      </div>
    </div>
  );
}
