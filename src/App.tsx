import { useState } from 'react';
import type { Screen, Interest } from './types/bubble';

import EntryScreen from './screens/EntryScreen';
import SetupScreen from './screens/SetupScreen';
import LobbyScreen from './screens/LobbyScreen';
import BubbleFieldScreen from './screens/BubbleFieldScreen';
import CommonGroundScreen from './screens/CommonGroundScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('entry');
  const [myInterests, setMyInterests] = useState<Interest[]>([]);
  const [roomCode] = useState('A8K2P9');
  const [showCommonGround, setShowCommonGround] = useState(false);
  const [selectedBubble, setSelectedBubble] = useState<Interest | null>(null);

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
        <LobbyScreen roomCode={roomCode} onNavigate={setCurrentScreen} />
      )}

      {currentScreen === 'field' && (
        <BubbleFieldScreen
          myInterests={myInterests}
          onShowCommonGround={() => setShowCommonGround(true)}
          selectedBubble={selectedBubble}
          setSelectedBubble={setSelectedBubble}
        />
      )}

      {showCommonGround && <CommonGroundScreen onClose={() => setShowCommonGround(false)} />}
    </div>
  );
}
