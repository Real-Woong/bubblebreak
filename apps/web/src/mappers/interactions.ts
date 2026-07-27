import type { ApiRoomEvent } from '../types/api';
import type { Participant } from '../types/bubble';

// 게임 중(✨ 버튼)에 "내가 지금까지 확인한 관심사"를 보여주기 위한 항목.
// 예전 commonInterestsMock 처럼 텍스트를 비교해서 "공통 관심사"를 추측하지 않고,
// 실제로 서버에 기록된 pop / deep3 승인 이벤트만 그대로 보여준다.
export type MyInteraction = {
  id: string;
  counterpartId: string;
  counterpartName: string;
  interestText: string;
  direction: 'iChecked' | 'theyChecked';
  icebreakers: string[];
};

function buildIcebreakers(text: string): string[] {
  return [
    `${text} 좋아하세요?`,
    `요즘 ${text} 관련해서 자주 하는 거 있어요?`,
    `${text}는 언제부터 관심 있었어요?`
  ];
}

export function buildMyInteractions(
  events: ApiRoomEvent[],
  participants: Participant[],
  currentUserId: string
): MyInteraction[] {
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const items: MyInteraction[] = [];

  events.forEach((event) => {
    const isRevealed =
      event.eventType === 'pop' ||
      (event.eventType === 'deep3_request' && event.status === 'accepted');
    if (!isRevealed) return;

    const iAmSource = event.sourceUserId === currentUserId;
    const iAmTarget = event.targetUserId === currentUserId;
    if (!iAmSource && !iAmTarget) return;

    const counterpartId = iAmSource ? event.targetUserId : event.sourceUserId;
    const counterpart = participantById.get(counterpartId);

    // interestId는 항상 "버블이 눌린 쪽(targetUserId)"의 관심사를 가리킨다.
    const owner = participantById.get(event.targetUserId);
    const interest = owner?.interests.find((item) => item.id === event.interestId);

    if (!counterpart || !interest || interest.text === '비공개 관심사') return;

    items.push({
      id: event.id,
      counterpartId,
      counterpartName: counterpart.name,
      interestText: interest.text,
      direction: iAmSource ? 'iChecked' : 'theyChecked',
      icebreakers: buildIcebreakers(interest.text)
    });
  });

  return items;
}
