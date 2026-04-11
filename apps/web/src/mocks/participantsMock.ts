import type { Participant } from '../types/bubble';

export const participantsMock: Participant[] = [
  {
    id: 'user-2',
    name: '민수',
    color: 'from-blue-400 to-cyan-400',
    interests: [
      { id: 'u1-1', text: '리그오브레전드', level: 'deep1' },
      { id: 'u1-2', text: '카페 탐방', level: 'deep1' },
      { id: 'u1-3', text: '힙합', level: 'deep2' },
      { id: 'u1-4', text: '야구', level: 'deep2' },
      { id: 'u1-5', text: '혼자 산책', level: 'deep3' }
    ]
  },
  {
    id: 'user-3',
    name: '지우',
    color: 'from-emerald-400 to-teal-400',
    interests: [
      { id: 'u2-1', text: '카페 탐방', level: 'deep1' },
      { id: 'u2-2', text: '넷플릭스', level: 'deep1' },
      { id: 'u2-3', text: '사진 찍기', level: 'deep2' },
      { id: 'u2-4', text: '전시회', level: 'deep2' },
      { id: 'u2-5', text: '새벽 감성', level: 'deep3' }
    ]
  },
  {
    id: 'user-4',
    name: '현우',
    color: 'from-orange-400 to-red-400',
    interests: [
      { id: 'u3-1', text: '헬스', level: 'deep1' },
      { id: 'u3-2', text: '야구', level: 'deep1' },
      { id: 'u3-3', text: '단백질 쉐이크', level: 'deep2' },
      { id: 'u3-4', text: '자기관리', level: 'deep2' },
      { id: 'u3-5', text: '루틴', level: 'deep3' }
    ]
  }
];