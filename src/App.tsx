import { useMemo, useState } from 'react';
import type { Screen, Interest, Participant } from './types/bubble';

import EntryScreen from './screens/EntryScreen';
import SetupScreen from './screens/SetupScreen';
import LobbyScreen from './screens/LobbyScreen';
import BubbleFieldScreen from './screens/BubbleFieldScreen';
import CommonGroundScreen from './screens/CommonGroundScreen';

import { participantsMock } from './mocks/participantsMock';
import { buildRoomSlots } from './mocks/roomSlotsMock';
import { buildCommonInterests } from './mocks/commonInterestsMock';

const CURRENT_USER_ID = 'me';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('entry');
  const [myInterests, setMyInterests] = useState<Interest[]>([]);
  const [roomCode] = useState('A8K2P9');
  const [showCommonGround, setShowCommonGround] = useState(false);
  const [selectedBubble, setSelectedBubble] = useState<Interest | null>(null);

  const currentUser: Participant = useMemo(
    () => ({
      id: CURRENT_USER_ID,
      name: '나',
      color: 'from-purple-400 to-pink-400',
      interests: myInterests
    }),
    [myInterests]
  );

  const participants = useMemo<Participant[]>(
    () => [currentUser, ...participantsMock],
    [currentUser]
  );

  const roomSlots = useMemo(
    () => buildRoomSlots(participants, CURRENT_USER_ID, 6),
    [participants]
  );

  const commonInterests = useMemo(
    () => buildCommonInterests(participants, CURRENT_USER_ID),
    [participants]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50">
      {currentScreen === 'entry' && <EntryScreen onNavigate={setCurrentScreen} />}

      {currentScreen === 'setup' && (
        <SetupScreen
          interests={myInterests}
          setInterests={setMyInterests}
          onNavigate={setCurrentScreen}
        />
      )}

      {currentScreen === 'lobby' && (
        <LobbyScreen
          roomCode={roomCode}
          slots={roomSlots}
          onNavigate={setCurrentScreen}
        />
      )}

      {currentScreen === 'field' && (
        <BubbleFieldScreen
          participants={participants}
          currentUserId={CURRENT_USER_ID}
          onShowCommonGround={() => setShowCommonGround(true)}
          selectedBubble={selectedBubble}
          setSelectedBubble={setSelectedBubble}
        />
      )}

      {showCommonGround && (
        <CommonGroundScreen
          commonInterests={commonInterests}
          onClose={() => setShowCommonGround(false)}
        />
      )}
    </div>
  );
}