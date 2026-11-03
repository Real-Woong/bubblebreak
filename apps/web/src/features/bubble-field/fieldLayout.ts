import type { Interest, Participant } from '../../types/bubble';

export type FieldBubble = {
  id: string;
  interest: Interest;
  participantId: string;
  participantName: string;
  worldX: number;
  worldY: number;
  size: number;
  isMine: boolean;
};

const CLUSTER_SPREAD_X = 260;
const CLUSTER_SPREAD_Y = 190;
const MIN_BUBBLE_SIZE = 104;
const MAX_BUBBLE_SIZE = 156;
const MIN_BUBBLE_GAP = 28;
const LEVEL_RADIUS: Record<Interest['level'], number> = {
  deep1: 120,
  deep2: 220,
  deep3: 320
};

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function bubblesOverlap(
  a: { x: number; y: number; size: number },
  b: { x: number; y: number; size: number }
) {
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  return distance < a.size / 2 + b.size / 2 + MIN_BUBBLE_GAP;
}

function findNonOverlappingPosition(
  center: { x: number; y: number },
  size: number,
  preferredRadius: number,
  placedBubbles: Array<{ x: number; y: number; size: number }>,
  seedBase: number
) {
  for (let ring = 0; ring < 16; ring += 1) {
    const radius = preferredRadius + ring * 34;
    const steps = 18 + ring * 6;

    for (let step = 0; step < steps; step += 1) {
      const randomOffset = seededRandom(seedBase + ring * 101 + step * 17) * 0.18;
      const angle = (step / steps) * Math.PI * 2 + randomOffset;
      const candidate = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
        size
      };

      if (placedBubbles.every((existingBubble) => !bubblesOverlap(existingBubble, candidate))) {
        return candidate;
      }
    }
  }

  return null;
}

export function buildWorldLayout(participants: Participant[], currentUserId: string) {
  const participantCount = Math.max(participants.length, 1);
  const clusters: Record<string, { x: number; y: number }> = {};

  participants.forEach((participant, index) => {
    const angle = (index / participantCount) * Math.PI * 2 - Math.PI / 2;
    clusters[participant.id] = {
      x: Math.cos(angle) * (participantCount <= 2 ? 180 : CLUSTER_SPREAD_X),
      y: Math.sin(angle) * (participantCount <= 2 ? 135 : CLUSTER_SPREAD_Y)
    };
  });

  const bubbles: FieldBubble[] = [];
  const placedBubbles: Array<{ x: number; y: number; size: number }> = [];

  participants.forEach((participant, participantIndex) => {
    const center = clusters[participant.id];

    participant.interests.forEach((interest, index) => {
      const size = Math.max(MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE - index * 8);
      const preferredRadius = LEVEL_RADIUS[interest.level];
      const seedBase =
        participantIndex * 1000 +
        index * 100 +
        participant.name.length * 17 +
        participant.id.length * 29;

      const position =
        findNonOverlappingPosition(center, size, preferredRadius, placedBubbles, seedBase) ??
        findNonOverlappingPosition(center, size, preferredRadius + 120, placedBubbles, seedBase + 999) ?? {
          x: center.x + participantIndex * 120 + index * 52,
          y: center.y + participantIndex * 80 + index * 64,
          size
        };

      placedBubbles.push(position);
      bubbles.push({
        id: `${participant.id}-${interest.id}`,
        interest,
        participantId: participant.id,
        participantName: participant.name,
        worldX: position.x,
        worldY: position.y,
        size: position.size,
        isMine: participant.id === currentUserId
      });
    });
  });

  return bubbles;
}

export function getBubbleMotionValues(bubble: FieldBubble, index: number) {
  return {
    floatDuration: 6.8 + seededRandom(index * 37 + bubble.participantId.length * 19) * 2.6,
    swayDuration: 5.4 + seededRandom(index * 41 + bubble.participantName.length * 11) * 1.8,
    floatX: Math.round(8 + seededRandom(index * 71 + bubble.size) * 10),
    floatY: Math.round(12 + seededRandom(index * 89 + bubble.size) * 14),
    rotateDeg: (1.8 + seededRandom(index * 61 + bubble.size * 3) * 2.4).toFixed(2),
    delay: -(seededRandom(index * 29 + bubble.interest.id.length * 17) * 4.8)
  };
}
