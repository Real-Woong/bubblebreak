import { Lock } from 'lucide-react';
import type { Interest } from '../types/bubble';

const USER_LEVEL_GRADIENTS = {
  user1: {
    deep1: 'linear-gradient(135deg, rgb(192 132 252), rgb(168 85 247))',
    deep2: 'linear-gradient(135deg, rgb(244 114 182), rgb(236 72 153))',
    deep3: 'linear-gradient(135deg, rgb(168 85 247), rgb(236 72 153))'
  },
  user2: {
    deep1: 'linear-gradient(135deg, rgb(190 242 100), rgb(163 230 53))',
    deep2: 'linear-gradient(135deg, rgb(74 222 128), rgb(34 197 94))',
    deep3: 'linear-gradient(135deg, rgb(132 204 22), rgb(22 163 74))'
  },
  user3: {
    deep1: 'linear-gradient(135deg, rgb(125 211 252), rgb(56 189 248))',
    deep2: 'linear-gradient(135deg, rgb(96 165 250), rgb(59 130 246))',
    deep3: 'linear-gradient(135deg, rgb(56 189 248), rgb(37 99 235))'
  },
  user4: {
    deep1: 'linear-gradient(135deg, rgb(253 224 71), rgb(250 204 21))',
    deep2: 'linear-gradient(135deg, rgb(251 191 36), rgb(245 158 11))',
    deep3: 'linear-gradient(135deg, rgb(250 204 21), rgb(217 119 6))'
  },
  user5: {
    deep1: 'linear-gradient(135deg, rgb(167 139 250), rgb(139 92 246))',
    deep2: 'linear-gradient(135deg, rgb(129 140 248), rgb(99 102 241))',
    deep3: 'linear-gradient(135deg, rgb(139 92 246), rgb(79 70 229))'
  },
  user6: {
    deep1: 'linear-gradient(135deg, rgb(153 246 228), rgb(45 212 191))',
    deep2: 'linear-gradient(135deg, rgb(45 212 191), rgb(20 184 166))',
    deep3: 'linear-gradient(135deg, rgb(45 212 191), rgb(13 148 136))'
  }
} as const;

function getUserSlot(participantId: string) {
  if (participantId === 'me' || participantId === 'user-1' || participantId === 'user1') {
    return 'user1';
  }

  const numericMatch = participantId.match(/\d+/);
  const numericId = numericMatch ? Number(numericMatch[0]) : 1;
  const normalized = Math.min(Math.max(numericId, 1), 6);

  return `user${normalized}` as keyof typeof USER_LEVEL_GRADIENTS;
}

function getBubbleGradient(participantId: string, level: Interest['level']) {
  const userSlot = getUserSlot(participantId);
  return USER_LEVEL_GRADIENTS[userSlot][level];
}

function getBubbleShadowByParticipant(participantId: string) {
  const userSlot = getUserSlot(participantId);

  switch (userSlot) {
    case 'user1':
      return '0 14px 30px rgba(168, 85, 247, 0.22), 0 6px 14px rgba(236, 72, 153, 0.14)';
    case 'user2':
      return '0 14px 30px rgba(132, 204, 22, 0.22), 0 6px 14px rgba(34, 197, 94, 0.14)';
    case 'user3':
      return '0 14px 30px rgba(56, 189, 248, 0.22), 0 6px 14px rgba(59, 130, 246, 0.14)';
    case 'user4':
      return '0 14px 30px rgba(250, 204, 21, 0.22), 0 6px 14px rgba(245, 158, 11, 0.14)';
    case 'user5':
      return '0 14px 30px rgba(139, 92, 246, 0.22), 0 6px 14px rgba(99, 102, 241, 0.14)';
    case 'user6':
      return '0 14px 30px rgba(45, 212, 191, 0.22), 0 6px 14px rgba(13, 148, 136, 0.14)';
    default:
      return '0 14px 30px rgba(168, 85, 247, 0.14), 0 6px 14px rgba(168, 85, 247, 0.10)';
  }
}

function getBubbleShadow(participantId: string, isSelected: boolean) {
  const baseShadow = getBubbleShadowByParticipant(participantId);

  return isSelected
    ? `${baseShadow}, 0 0 0 4px rgba(255, 255, 255, 0.78)`
    : baseShadow;
}

function getBubbleSurfaceStyle(isSelected: boolean) {
  return {
    boxShadow: isSelected
      ? 'inset -10px -16px 24px rgba(255,255,255,0.10), inset 12px 16px 28px rgba(255,255,255,0.22)'
      : 'inset -10px -16px 24px rgba(255,255,255,0.08), inset 12px 16px 28px rgba(255,255,255,0.16)'
  };
}

function getBubbleHighlightStyle() {
  return {
    background:
      'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.38), rgba(255,255,255,0.08) 42%, rgba(255,255,255,0.02) 66%, transparent 74%)'
  };
}

function getBubbleDepthOverlayStyle() {
  return {
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.02) 40%, rgba(15,23,42,0.10) 100%)'
  };
}

function getAdaptiveFontSize(text: string, baseSize: number, sizePx: number) {
  let fontSize = baseSize;

  // 대략 한 줄에 들어갈 수 있는 글자 수 (경험적 값)
  const getCharsPerLine = (fs: number) => Math.floor((sizePx * 0.82) / (fs * 0.56));

  // 목표: 2줄 안에 들어가도록
  while (fontSize > 9) {
    const charsPerLine = getCharsPerLine(fontSize);
    const requiredLines = Math.ceil(text.length / charsPerLine);

    if (requiredLines <= 2) break;
    fontSize -= 1;
  }

  return fontSize;
}

export default function BubbleField({
  interest,
  participantId,
  participantColor,
  sizePx,
  isMine,
  isSelected,
  onTap
}: {
  interest: Interest;
  participantId: string;
  participantColor: string;
  sizePx: number;
  isMine: boolean;
  isSelected: boolean;
  onTap: () => void;
}) {
  const baseFontSize = Math.max(16, Math.round(sizePx * 0.14));
  return (
    <div
      onClick={() => {
        if (!isMine) onTap();
      }}
      className="relative w-full h-full"
      style={{
        borderRadius: '9999px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        outline: 'none',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        pointerEvents: 'auto',
        boxShadow: getBubbleShadow(participantId, isSelected)
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          pointerEvents: 'none',
          background: getBubbleGradient(participantId, interest.level),
          ...getBubbleSurfaceStyle(isSelected)
        }}
      />
      <div
        className="absolute inset-[7%] rounded-full"
        style={{
          pointerEvents: 'none',
          ...getBubbleHighlightStyle()
        }}
      />
      <div
        className="absolute top-[14%] left-[20%] rounded-full blur-sm"
        style={{
          pointerEvents: 'none',
          width: `${Math.max(26, sizePx * 0.18)}px`,
          height: `${Math.max(18, sizePx * 0.12)}px`,
          background: 'rgba(255,255,255,0.34)',
          transform: 'rotate(-18deg)'
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          pointerEvents: 'none',
          ...getBubbleDepthOverlayStyle()
        }}
      />
      <div
        className="relative z-10 w-full h-full flex items-center justify-center text-center"
        style={{
          pointerEvents: 'none',
          padding: `${Math.max(12, sizePx * 0.14)}px`
        }}
      >
        {interest.level === 'deep3' ? (
          <div className="flex flex-col items-center justify-center text-center">
            <Lock className="w-5 h-5 text-white/95 mb-1" />
            <span className="text-[11px] uppercase tracking-[0.14em] opacity-85 text-white">
              private
            </span>
          </div>
        ) : interest.level === 'deep2' ? (
          <span
            style={{
              fontSize: `${getAdaptiveFontSize(interest.text, baseFontSize, sizePx)}px`,
              fontWeight: 700,
              lineHeight: 1.14,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              maxWidth: `${sizePx * 0.82}px`,
              textAlign: 'center',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
            className="text-white blur-[2px]"
          >
            {interest.text}
          </span>
        ) : (
          <span
            style={{
              fontSize: `${getAdaptiveFontSize(interest.text, baseFontSize, sizePx)}px`,
              fontWeight: 700,
              lineHeight: 1.14,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              maxWidth: `${sizePx * 0.82}px`,
              textAlign: 'center',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
            className="text-white"
          >
            {interest.text}
          </span>
        )}
      </div>
    </div>
  );
}