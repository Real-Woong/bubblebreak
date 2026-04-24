// Setup 화면에서 사용하는 관심사 depth 값
// 현재 기획상 deep1 / deep2 / deep3 세 단계만 허용한다.
export type InterestLevel = "deep1" | "deep2" | "deep3";

// 관심사 1개에 대한 표준 데이터 shape
// 예: { text: "개발", level: "deep1" }
export type Interest = {
  text: string;
  level: InterestLevel;
};

// DB에 저장된 관심사 데이터 shape
// worker는 interests_json 필드에 JSON 문자열로 관심사 데이터를 저장한다.
// 예: '[{"interestId":"uuid","text":"개발","level":"deep1"}]'
export type StoredInterest = {
  interestId: string;
  text: string;
  level: InterestLevel;
};

// 허용 가능한 level 목록
// 문자열 비교 시 오타를 막기 위해 상수 배열로 관리한다.
const ALLOWED_LEVELS: InterestLevel[] = ["deep1", "deep2", "deep3"];
// 관심사 텍스트 최대 길이
// 너무 긴 값이 들어와 UI를 깨뜨리거나 품질을 떨어뜨리지 않게 제한한다.
const MAX_INTEREST_TEXT_LENGTH = 20;
// level 하나당 최대 3개까지 허용
// FE 제약을 BE에서도 동일하게 강제하기 위한 값이다.
const MAX_INTERESTS_PER_LEVEL = 3;

// 검증 성공/실패를 명확하게 나누기 위한 결과 타입
// 성공 시에는 정규화된 interests를 반환하고,
// 실패 시에는 사용자에게 보여줄 수 있는 메시지를 반환한다.
type ValidationResult =
  | {
      ok: true;
      interests: Interest[];
    }
  | {
      ok: false;
      message: string;
    };

// create / join에서 공통으로 쓰는 관심사 검증 함수
// 입력값을 받아 "유효한지"와 "정리된 결과값"을 함께 반환한다.
export function validateInterests(value: unknown): ValidationResult {
  // 1. interests는 반드시 배열이어야 한다.
  // 예: [{ text: "...", level: "deep1" }]
  if (!Array.isArray(value)) {
    return {
      ok: false,
      message: "interests must be an array",
    };
  }

  // 검증을 통과한 항목들을 최종 저장용 배열로 모은다.
  const normalized: Interest[] = [];
  // deep1/deep2/deep3별 개수 제한 체크용 카운터
  // 같은 level이 4개 이상 들어오면 실패시킨다.
  const levelCounts: Record<InterestLevel, number> = {
    deep1: 0,
    deep2: 0,
    deep3: 0,
  };

  // 2. 배열의 각 항목을 하나씩 검사
  for (const item of value) {
    // 각 항목은 객체여야 text / level 속성 검증이 가능하다.
    if (!item || typeof item !== "object") {
      return {
        ok: false,
        message: "each interest must be an object",
      };
    }

    const { text, level } = item as {
      text?: unknown;
      level?: unknown;
    };

    // text는 문자열이어야 한다.
    if (typeof text !== "string") {
      return {
        ok: false,
        message: "interest text is required",
      };
    }

    const trimmedText = text.trim();

    // trim 후 빈 문자열이면 의미 있는 관심사가 아니므로 거절한다.
    if (!trimmedText) {
      return {
        ok: false,
        message: "interest text cannot be empty",
      };
    }

    // 너무 긴 관심사는 DB 저장 전에 차단한다.
    // 이 제한은 UI/UX와 데이터 품질을 동시에 지키기 위한 것이다.
    if (trimmedText.length > MAX_INTEREST_TEXT_LENGTH) {
      return {
        ok: false,
        message: `interest text must be ${MAX_INTEREST_TEXT_LENGTH} characters or fewer`,
      };
    }

    // level은 미리 정의한 세 값만 허용한다.
    if (typeof level !== "string" || !ALLOWED_LEVELS.includes(level as InterestLevel)) {
      return {
        ok: false,
        message: "interest level must be one of deep1, deep2, deep3",
      };
    }

    const typedLevel = level as InterestLevel;
    levelCounts[typedLevel] += 1;

    // 같은 level 안에서 3개를 넘기면 바로 실패
    // 예: deep1이 4개 들어오면 invalid
    if (levelCounts[typedLevel] > MAX_INTERESTS_PER_LEVEL) {
      return {
        ok: false,
        message: `${typedLevel} can have at most ${MAX_INTERESTS_PER_LEVEL} interests`,
      };
    }

    // text는 trim된 값으로 정규화해서 저장/반환한다.
    // 이렇게 하면 앞뒤 공백이 섞인 입력도 동일한 형태로 다룰 수 있다.
    normalized.push({
      text: trimmedText,
      level: typedLevel,
    });
  }

  // 3. 모든 항목이 통과하면 정리된 배열을 반환한다.
  return {
    ok: true,
    interests: normalized,
  };
}

// 검증이 끝난 관심사 배열에 서버 기준 interestId를 부여한다.
export function attachInterestIds(interests: Interest[]): StoredInterest[] {
  return interests.map((interest) => ({
    interestId: crypto.randomUUID(),
    text: interest.text,
    level: interest.level,
  }));
}
