// 버블(원) 안에 텍스트가 들어가도록 폰트 크기/줄 수를 계산한다. (BubbleField, BubblePreview 공용)

export type BubbleTextFit = {
  fontSize: number;
  lineClamp: number;
  maxWidth: number;
};

// 한글/CJK는 1em, 그 외 글자는 약 0.56em으로 가정
export function estimateTextWidthEm(text: string): number {
  let width = 0;
  for (const char of text) {
    width += /[ᄀ-ᇿ㄰-㆏가-힯぀-ヿ一-鿿]/.test(char) ? 1 : 0.56;
  }
  return width;
}

const LINE_HEIGHT = 1.15;

export function fitBubbleText(
  text: string,
  diameter: number,
  options: { baseFontSize: number; minFontSize?: number; maxLines?: number } = { baseFontSize: 14 }
): BubbleTextFit {
  const minFontSize = options.minFontSize ?? 9;
  const maxLines = options.maxLines ?? 3;
  // 원에 내접하는 정사각형 안쪽(여백 포함)을 텍스트 영역으로 쓴다.
  const box = Math.max(10, diameter * 0.66);
  const widthEm = estimateTextWidthEm(text);

  for (let fontSize = Math.floor(options.baseFontSize); fontSize >= minFontSize; fontSize--) {
    const linesAvailable = Math.min(maxLines, Math.max(1, Math.floor(box / (fontSize * LINE_HEIGHT))));
    const linesNeeded = Math.ceil((widthEm * fontSize) / box);
    if (linesNeeded <= linesAvailable) {
      return { fontSize, lineClamp: linesAvailable, maxWidth: box };
    }
  }

  // 최소 폰트로도 안 들어가면 줄 수를 제한하고 말줄임(…) 처리
  const linesAvailable = Math.min(maxLines, Math.max(1, Math.floor(box / (minFontSize * LINE_HEIGHT))));
  return { fontSize: minFontSize, lineClamp: linesAvailable, maxWidth: box };
}
