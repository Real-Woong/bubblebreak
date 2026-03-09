import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import type { Interest } from '../types/bubble';

export default function BubblePreview({ interest, index }: { interest: Interest; index: number }) {
  const colors: Record<string, string> = {
    deep1: 'from-purple-400 to-purple-500',
    deep2: 'from-pink-400 to-pink-500',
    deep3: 'from-purple-500 to-pink-600'
  };

  const sizes = ['w-20 h-20', 'w-24 h-24', 'w-16 h-16'];

  // Deterministic jitter so bubbles look randomly placed but don't jump on re-render.
  const { dx, dy } = useMemo(() => {
    const str = `${index}-${interest.level}-${interest.text}`;

    // Simple string hash
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    // Mulberry32 PRNG
    const rand = (seed: number) => {
      let t = seed >>> 0;
      t += 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const r1 = rand(h);
    const r2 = rand(h ^ 0x9e3779b9);

    // Keep jitter small so it stays within the parent frame.
    const max = 12; // px
    const dx = Math.round((r1 * 2 - 1) * max);
    const dy = Math.round((r2 * 2 - 1) * max);
    return { dx, dy };
  }, [index, interest.level, interest.text]);

  return (
    <div
      className={`${sizes[index % 3]} relative mx-2`}
      style={{ transform: `translate(${dx}px, ${dy}px)` }}
    >
      <div
        className={`w-full h-full bg-gradient-to-br ${colors[interest.level]} rounded-full shadow-lg flex items-center justify-center p-3 animate-pulse`}
        style={{ animationDelay: `${index * 0.3}s` }}
      >
        {interest.level === 'deep3' ? (
          <Lock className="w-6 h-6 text-white" />
        ) : interest.level === 'deep2' ? (
          <span className="text-xs text-white text-center font-medium blur-sm">{interest.text}</span>
        ) : (
          <span className="text-xs text-white text-center font-medium leading-tight">{interest.text}</span>
        )}
      </div>
    </div>
  );
}
