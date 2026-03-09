import { Lock } from 'lucide-react';
import type { Interest } from '../types/bubble';

export default function BubbleField({
  interest,
  participantId,
  participantColor,
  index,
  onTap
}: {
  interest: Interest;
  participantId: string;
  participantColor: string;
  index: number;
  onTap: (interest: Interest, participantId: string) => void;
}) {
  const sizes = ['w-20 h-20 text-xs', 'w-24 h-24 text-sm', 'w-16 h-16 text-xs'];
  const size = sizes[index % 3];

  const isMyBubble = participantId === 'me';

  return (
    <button
      onClick={() => onTap(interest, participantId)}
      disabled={isMyBubble}
      className={`${size} relative group ${isMyBubble ? 'cursor-default' : 'cursor-pointer active:scale-95 transition-transform'}`}
    >
      <div className={`w-full h-full bg-gradient-to-br ${participantColor} rounded-full shadow-lg flex items-center justify-center p-3 relative overflow-hidden`}>
        {!isMyBubble && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-active:translate-x-full transition-transform duration-700"></div>
        )}

        {interest.level === 'deep3' ? (
          <div className="text-center">
            <Lock className="w-5 h-5 text-white mx-auto mb-1" />
            <span className="text-[10px] text-white/80">비공개</span>
          </div>
        ) : interest.level === 'deep2' ? (
          <span className="text-white text-center font-medium leading-tight blur-[2px]">{interest.text}</span>
        ) : (
          <span className="text-white text-center font-medium leading-tight">{interest.text}</span>
        )}
      </div>
    </button>
  );
}
