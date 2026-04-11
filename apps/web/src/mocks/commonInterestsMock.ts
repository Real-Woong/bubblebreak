import type { CommonInterest, Participant } from '../types/bubble';

export function buildCommonInterests(
  participants: Participant[],
  currentUserId: string
): CommonInterest[] {
  const me = participants.find((participant) => participant.id === currentUserId);
  if (!me) return [];

  const myInterestMap = new Map(
    me.interests.map((interest) => [interest.text.trim().toLowerCase(), interest])
  );

  const result: CommonInterest[] = [];

  participants
    .filter((participant) => participant.id !== currentUserId)
    .forEach((participant) => {
      participant.interests.forEach((interest) => {
        const key = interest.text.trim().toLowerCase();
        const matchedMine = myInterestMap.get(key);

        if (!matchedMine) return;

        result.push({
          id: `${me.id}-${participant.id}-${interest.id}`,
          interestId: interest.id,
          interest: interest.text,
          ownerUserId: me.id,
          ownerUserName: me.name,
          matchedUserId: participant.id,
          matchedUserName: participant.name,
          icebreakers: [
            `${interest.text} 좋아하세요?`,
            `요즘 ${interest.text} 관련해서 자주 하는 거 있어요?`,
            `${interest.text}는 언제부터 관심 있었어요?`
          ]
        });
      });
    });

  return result;
}