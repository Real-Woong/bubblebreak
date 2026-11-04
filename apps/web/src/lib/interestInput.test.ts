import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateInterestInput, normalizeInterestText, shouldIgnoreEnter } from './interestInput.ts';

test('앞뒤 공백을 trim하고 빈 값은 무시한다', () => {
  assert.equal(normalizeInterestText('  맛집  '), '맛집');
  assert.deepEqual(evaluateInterestInput('   ', []), { status: 'empty' });
});

test('중복이면 duplicate (앞뒤 공백 무시)', () => {
  assert.deepEqual(evaluateInterestInput(' 맛집 ', ['맛집']), { status: 'duplicate' });
  assert.deepEqual(evaluateInterestInput('Music', ['music']), { status: 'duplicate' });
});

test('단계당 3개를 넘으면 full', () => {
  assert.deepEqual(evaluateInterestInput('영화', ['a', 'b', 'c']), { status: 'full' });
});

test('정상 입력은 added, 12자를 넘으면 잘린다', () => {
  assert.deepEqual(evaluateInterestInput('영화', ['맛집']), { status: 'added', text: '영화' });
  const result = evaluateInterestInput('가'.repeat(20), []);
  assert.equal(result.status === 'added' && result.text.length, 12);
});

test('IME 조합 중 Enter는 무시한다', () => {
  assert.equal(shouldIgnoreEnter({ isComposing: true }, false), true);
  assert.equal(shouldIgnoreEnter({ isComposing: false }, true), true);
  assert.equal(shouldIgnoreEnter({ keyCode: 229 }, false), true);
  assert.equal(shouldIgnoreEnter({ isComposing: false, keyCode: 13 }, false), false);
});
