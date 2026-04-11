import type { Participant, RoomSlot } from '../types/bubble';

export function buildRoomSlots(
  participants: Participant[],
  currentUserId: string,
  maxSlots = 6
): RoomSlot[] {
  const filledSlots: RoomSlot[] = participants.slice(0, maxSlots).map((participant) => ({
    id: `slot-${participant.id}`,
    type: 'participant',
    participant,
    status:
      participant.id === currentUserId || participant.interests.length > 0 ? 'ready' : 'waiting'
  }));

  const emptySlots: RoomSlot[] = Array.from(
    { length: Math.max(0, maxSlots - filledSlots.length) },
    (_, index) => ({
      id: `slot-empty-${index + 1}`,
      type: 'empty'
    })
  );

  return [...filledSlots, ...emptySlots];
}