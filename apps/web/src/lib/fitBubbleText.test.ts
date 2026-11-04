import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTextWidthEm, fitBubbleText } from './fitBubbleText.ts';

test('한글은 1em, 영문은 더 좁게 계산한다', () => {
  assert.equal(estimateTextWidthEm('가나다'), 3);
  assert.ok(estimateTextWidthEm('abc') < 3);
});

test('짧은 텍스트는 기본 폰트를 유지한다', () => {
  const fit = fitBubbleText('맛집', 88, { baseFontSize: 14 });
  assert.equal(fit.fontSize, 14);
});

test('긴 텍스트는 폰트를 줄이거나 줄 수를 제한해 원 안에 맞춘다', () => {
  for (const size of [48, 64, 88, 120]) {
    const text = '가'.repeat(12);
    const fit = fitBubbleText(text, size, { baseFontSize: 16, minFontSize: 9, maxLines: 3 });
    assert.ok(fit.fontSize >= 9 && fit.fontSize <= 16);
    assert.ok(fit.maxWidth <= size * 0.7);
    // 텍스트 영역 높이가 원의 내접 영역을 넘지 않는다
    assert.ok(fit.lineClamp * fit.fontSize * 1.15 <= size * 0.7 + 1);
  }
});
