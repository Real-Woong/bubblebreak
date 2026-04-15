import { useLayoutEffect, useRef, useState } from 'react';
import type { Screen } from '../types/bubble';
import { Sparkles, Users } from 'lucide-react';

// 로고 이미지
// 주의: 이 경로는 "현재 파일 위치" 기준 상대경로여야 함
import BubbleBreakLogo from '../components/image/logo/BubbleBreakLogo.png';

// Entry 화면에서 선택 가능한 모드
type EntryMode = 'create' | 'join';

export default function EntryScreen({
  nickname,
  setNickname,
  roomCodeInput,
  setRoomCodeInput,
  setMode,
  onNavigate
}: {
  // 부모(App.tsx)에서 내려준 닉네임 상태
  nickname: string;

  // 닉네임 변경 함수
  setNickname: (value: string) => void;

  // 방 참여 시 사용하는 방 코드 입력값
  roomCodeInput: string;

  // 방 코드 변경 함수
  setRoomCodeInput: (value: string) => void;

  // create / join 선택값 저장
  setMode: (mode: EntryMode) => void;

  // 현재 화면 전환 함수
  onNavigate: (screen: Screen) => void;
}) {
  // 타이틀 실제 너비를 읽기 위한 ref
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  // 로고 박스 크기를 타이틀 너비에 맞추기 위한 상태
  const [heroWidth, setHeroWidth] = useState<number | null>(null);

  // 렌더링 후 실제 타이틀 width를 읽어서 로고 컨테이너에도 동일 적용
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

  // "방 만들기" 버튼 클릭
  const handleCreate = () => {
    // 닉네임이 비어 있으면 진행 막기
    if (!nickname.trim()) return;

    // 현재 흐름을 create로 저장
    setMode('create');

    // create도 setup을 먼저 거친다
    onNavigate('setup');
  };

  // "방 참여하기" 버튼 클릭
  const handleJoin = () => {
    // 닉네임 없으면 진행 불가
    if (!nickname.trim()) return;

    // join은 방 코드도 필요
    if (!roomCodeInput.trim()) return;

    // 현재 흐름을 join으로 저장
    setMode('join');

    // join도 setup을 먼저 거친다
    onNavigate('setup');
  };

  return (
    <div className="min-h-screen px-5 pt-10 pb-8 flex">
      <div className="max-w-[375px] w-full mx-auto flex flex-col flex-1">
        <div className="flex-1 flex flex-col justify-center">
          {/* 상단 브랜드 영역 */}
          <div className="text-center">
            <div className="flex flex-col items-center gap-3">
              {/* 로고 박스
                  title width와 동일한 정사각형으로 보여주기 */}
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

              {/* 서비스 타이틀 */}
              <h1
                ref={titleRef}
                className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent"
              >
                BubbleBreak
              </h1>

              {/* 서비스 한 줄 소개 */}
              <div className="space-y-1">
                <p className="text-base text-gray-700 leading-relaxed">
                  관심사로 자연스럽게 대화 시작하기
                </p>
                <p className="text-sm text-gray-500">
                  낯설지 않게, 부담 없이
                </p>
              </div>
            </div>
          </div>

          {/* 입력 및 설명 카드 영역 */}
          <div className="space-y-3 mt-8">
            {/* 닉네임 입력 */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 border border-purple-100/50 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                닉네임
              </label>

              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={12}
                placeholder="닉네임을 입력하세요"
                className="w-full bg-white border-2 border-purple-200 rounded-full px-4 py-3 text-sm focus:outline-none focus:border-purple-400"
              />
            </div>

            {/* 제품 설명 카드 1 */}
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 border border-purple-100/50 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1 pt-1">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">
                    3단계 관심사 시스템
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    공개부터 비공개까지, 내가 선택하는 깊이
                  </p>
                </div>
              </div>
            </div>

            {/* 제품 설명 카드 2 */}
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 border border-purple-100/50 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1 pt-1">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">
                    최대 6명의 소규모 룸
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    부담 없는 인원, 편안한 분위기
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 CTA 버튼 영역 */}
        <div className="space-y-4">
          {/* 방 만들기:
              닉네임만 있으면 setup으로 이동 */}
          <button
            onClick={handleCreate}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-full font-semibold text-base shadow-lg shadow-purple-200/50 active:scale-95 transition-transform"
          >
            방 만들기
          </button>

          {/* 방 참여하기 전용 방 코드 입력
              시선 흐름상 참여 버튼 바로 위에 배치 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 border border-purple-100/50 shadow-sm">

            <input
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="참여 시 방 코드를 입력하세요"
              className="w-full bg-white border-2 border-purple-200 rounded-full px-4 py-3 text-sm focus:outline-none focus:border-purple-400"
            />

            <p className="text-xs text-gray-500 mt-2 text-center">
              방 참여 시에만 입력하면 돼요
            </p>
          </div>

          {/* 방 참여하기:
              닉네임 + 방 코드 둘 다 있어야 setup으로 이동 */}
          <button
            onClick={handleJoin}
            className="w-full bg-white/80 backdrop-blur-sm text-purple-600 py-4 rounded-full font-semibold text-base border-2 border-purple-200 active:scale-95 transition-transform"
          >
            방 참여하기
          </button>

          <p className="text-center text-xs text-gray-500 pt-1">
            💾 계정 없이, 가볍게 시작해요
          </p>
        </div>
      </div>
    </div>
  );
}