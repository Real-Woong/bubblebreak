import { Lock } from 'lucide-react';
import type { Interest } from '../types/bubble';

const LEVEL_GRADIENTS: Record<Interest['level'], string> = {
  deep1: 'from-purple-400 to-purple-500',
  deep2: 'from-pink-400 to-pink-500',
  deep3: 'from-purple-500 to-pink-600'
};

const LEVEL_SIZES: Record<Interest['level'], number> = {
  deep1: 88,
  deep2: 76,
  deep3: 64
};

export default function BubblePreview({
  interest,
  index,
  size: externalSize,
  showLock = true,
  forceLabelVisible = false
}: {
  interest: Interest;
  index: number;
  size?: number;
  showLock?: boolean;
  forceLabelVisible?: boolean;
}) {
  const gradient = LEVEL_GRADIENTS[interest.level];
  const size = externalSize ?? (LEVEL_SIZES[interest.level] + (index % 2 === 0 ? 0 : 4));

  return (
    <div
      className={`relative rounded-full flex items-center justify-center text-center shadow-lg shrink-0 bg-gradient-to-r ${gradient} text-white select-none`}
      style={{
        width: size,
        height: size
      }}
    >
      {showLock && interest.level === 'deep3' && (
        <Lock className="absolute top-2 right-2 w-4 h-4 text-white/90" />
      )}

      <span
        className={`px-2 text-white font-medium leading-tight text-center ${
          forceLabelVisible ? 'text-[11px] whitespace-normal break-keep' : 'text-xs'
        }`}
      >
        {interest.text}
      </span>
    </div>
  );
}