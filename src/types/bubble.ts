export type Screen = 'entry' | 'setup' | 'lobby' | 'field' | 'commonGround';
export type DeepLevel = 'deep1' | 'deep2' | 'deep3';

export interface Interest {
  id: string;
  text: string;
  level: DeepLevel;
}

export interface Participant {
  id: string;
  name: string;
  interests: Interest[];
  color: string;
}
