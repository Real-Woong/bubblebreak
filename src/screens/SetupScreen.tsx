import { useState } from 'react';
import { Lock, Plus, X, ChevronRight } from 'lucide-react';
import type { Screen, DeepLevel, Interest } from '../types/bubble';
import BubblePreview from '../components/BubblePreview';

export default function SetupScreen({
  interests,
  setInterests,
  onNavigate
}: {
  interests: Interest[];
  setInterests: (interests: Interest[]) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const [activeLevel, setActiveLevel] = useState<DeepLevel>('deep1');
  const [inputValue, setInputValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const addInterest = () => {
    if (!inputValue.trim()) return;

    const levelInterests = interests.filter((i) => i.level === activeLevel);
    if (levelInterests.length >= 3) return;

    setInterests([
      ...interests,
      { id: Date.now().toString(), text: inputValue.trim(), level: activeLevel }
    ]);
    setInputValue('');
  };

  const removeInterest = (id: string) => {
    setInterests(interests.filter((i) => i.id !== id));
  };

  const levels = [
    {
      id: 'deep1' as DeepLevel,
      label: 'Deep 1',
      desc: '공개',
      color: 'from-purple-400 to-purple-500',
      example: '게임, 운동, 음악 등'
    },
    {
      id: 'deep2' as DeepLevel,
      label: 'Deep 2',
      desc: '반공개',
      color: 'from-pink-400 to-pink-500',
      example: '조금 개인적인 취미'
    },
    {
      id: 'deep3' as DeepLevel,
      label: 'Deep 3',
      desc: '비공개',
      color: 'from-purple-500 to-pink-600',
      example: '부끄럽거나 민감한 관심사'
    }
  ];

  const currentInterests = interests.filter((i) => i.level === activeLevel);
  const currentLevel = levels.find((l) => l.id === activeLevel);

  return (
    <div className="min-h-screen pb-8">
      <div className="max-w-[375px] mx-auto">
        {/* Header */}
        <div className="px-5 pt-8 pb-6 bg-gradient-to-br from-purple-100/50 to-pink-100/50">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">내 관심사 설정하기</h2>
          <p className="text-sm text-gray-600">각 단계별로 최대 3개까지 입력할 수 있어요</p>
        </div>

        {/* Level tabs */}
        <div className="px-5 py-4 bg-white/50 border-b border-purple-100">
          <div className="flex gap-2">
            {levels.map((level) => (
              <button
                key={level.id}
                onClick={() => setActiveLevel(level.id)}
                className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all ${
                  activeLevel === level.id
                    ? `bg-gradient-to-r ${level.color} text-white shadow-md`
                    : 'bg-white/70 text-gray-600'
                }`}
              >
                <div>{level.label}</div>
                <div className="text-xs opacity-80">{level.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pt-6">
          {/* Level info */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-purple-100/50">
            <div className="flex items-start gap-3">
              {activeLevel === 'deep3' && <Lock className="w-5 h-5 text-purple-500 mt-0.5" />}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">
                  {currentLevel?.label} - {currentLevel?.desc}
                </h3>
                <p className="text-xs text-gray-600">예시: {currentLevel?.example}</p>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  // When using Korean IME, Enter can fire while composing, causing partial/duplicate adds.
                  // Ignore Enter during composition.
                  // (React/SyntheticEvent may not expose isComposing consistently across browsers.)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const native = (e as any).nativeEvent;
                  if (isComposing || native?.isComposing) return;
                  e.preventDefault();
                  addInterest();
                }}
                placeholder="관심사를 입력하세요"
                maxLength={20}
                disabled={currentInterests.length >= 3}
                className="flex-1 bg-white/80 backdrop-blur-sm border-2 border-purple-200 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-purple-400 disabled:opacity-50"
              />
              <button
                onClick={addInterest}
                disabled={!inputValue.trim() || currentInterests.length >= 3}
                className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 px-2">{currentInterests.length}/3</p>
          </div>

          {/* Interest chips */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">추가된 관심사</h4>
            {currentInterests.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">아직 추가된 관심사가 없어요</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentInterests.map((interest) => (
                  <div
                    key={interest.id}
                    className={`bg-gradient-to-r ${currentLevel?.color} text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm`}
                  >
                    {activeLevel === 'deep3' && <Lock className="w-3.5 h-3.5" />}
                    <span>{interest.text}</span>
                    <button
                      onClick={() => removeInterest(interest.id)}
                      className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live preview bubbles */}
          <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 rounded-3xl p-6 mb-6 border border-purple-100/50">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 text-center">내 버블 미리보기</h4>
            <div className="relative h-40 flex items-center justify-center">
              {interests.length === 0 ? (
                <p className="text-sm text-gray-400">관심사를 추가하면 여기에 표시돼요</p>
              ) : (
                <div className="flex flex-wrap gap-3 justify-center">
                  {interests.map((interest, idx) => (
                    <BubblePreview key={interest.id} interest={interest} index={idx} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 mt-4">
          <button
            onClick={() => onNavigate('lobby')}
            disabled={interests.length === 0}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-full font-semibold shadow-lg shadow-purple-200/50 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            버블 만들기
            <ChevronRight className="w-5 h-5" />
          </button>

          {interests.length === 0 && (
            <p className="text-xs text-center text-gray-500 mt-3">최소 1개 이상의 관심사를 추가해주세요</p>
          )}
        </div>
      </div>
    </div>
  );
}
