// 관심사 직접 입력 정규화/판정 (의존성 없는 순수 모듈)
export const MAX_INTEREST_LENGTH = 12;
export const MAX_INTERESTS_PER_LEVEL = 3;
export const DUPLICATE_INTEREST_MESSAGE = '이미 추가한 관심사예요';

export type AddInterestResult =
  | { status: 'added'; text: string }
  | { status: 'empty' }
  | { status: 'full' }
  | { status: 'duplicate' };

export function normalizeInterestText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_INTEREST_LENGTH);
}

// existingTexts: 같은 단계(level)에 이미 들어간 관심사 텍스트
export function evaluateInterestInput(value: string, existingTexts: string[]): AddInterestResult {
  const text = normalizeInterestText(value);
  if (!text) return { status: 'empty' };
  if (existingTexts.length >= MAX_INTERESTS_PER_LEVEL) return { status: 'full' };
  if (existingTexts.some((existing) => existing.toLowerCase() === text.toLowerCase())) {
    return { status: 'duplicate' };
  }
  return { status: 'added', text };
}

// IME 조합 중 Enter는 무시해야 한다. (keyCode 229는 일부 브라우저의 조합 종료 직후 keydown)
export function shouldIgnoreEnter(event: { isComposing?: boolean; keyCode?: number }, localComposing: boolean) {
  return localComposing || Boolean(event.isComposing) || event.keyCode === 229;
}
