import { Lock } from 'lucide-react';
import type { Interest } from '../types/bubble';

// BubbleBreak 시그니처 팔레트
// Setup 화면과 같은 계열을 유지하되,
// BubbleField에서는 사용자별 차이를 없애고 depth만 색으로 구분한다.
const LEVEL_GRADIENTS: Record<Interest['level'], string> = {
  deep1: 'linear-gradient(135deg, rgb(192 132 252), rgb(168 85 247))',
  deep2: 'linear-gradient(135deg, rgb(244 114 182), rgb(236 72 153))',
  deep3: 'linear-gradient(135deg, rgb(168 85 247), rgb(219 39 119))'
};

function getBubbleGradient(level: Interest['level']) {
  return LEVEL_GRADIENTS[level];
}

function getBubbleShadowByLevel(level: Interest['level']) {
  switch (level) {
    case 'deep1':
      return '0 14px 30px rgba(192, 132, 252, 0.24), 0 6px 14px rgba(168, 85, 247, 0.16)';
    case 'deep2':
      return '0 14px 30px rgba(244, 114, 182, 0.24), 0 6px 14px rgba(236, 72, 153, 0.16)';
    case 'deep3':
      return '0 14px 30px rgba(168, 85, 247, 0.24), 0 6px 14px rgba(219, 39, 119, 0.16)';
    default:
      return '0 14px 30px rgba(192, 132, 252, 0.18), 0 6px 14px rgba(192, 132, 252, 0.10)';
  }
}

function getBubbleShadow(level: Interest['level'], isSelected: boolean) {
  const baseShadow = getBubbleShadowByLevel(level);

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
  sizePx,
  isMine,
  isSelected,
  onTap
}: {
  interest: Interest;
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
        boxShadow: getBubbleShadow(interest.level, isSelected)
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          pointerEvents: 'none',
          background: getBubbleGradient(interest.level),
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
