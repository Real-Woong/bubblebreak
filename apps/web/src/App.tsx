import { useMemo, useState } from 'react';
import type { Interest, Participant, Screen } from './types/bubble';
import EntryScreen from './screens/EntryScreen';
import SetupScreen from './screens/SetupScreen';
import LobbyScreen from './screens/LobbyScreen';
import BubbleFieldScreen from './screens/BubbleFieldScreen';
import CommonGroundScreen from './screens/CommonGroundScreen';
import RecommendationScreen from './screens/RecommendationScreen';
import { buildCommonInterests } from './mocks/commonInterestsMock';

type EntryMode = 'create' | 'join';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('entry');
  const [nickname, setNickname] = useState('');
  const [mode, setMode] = useState<EntryMode | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [myInterests, setMyInterests] = useState<Interest[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [showCommonGround, setShowCommonGround] = useState(false);
  const [selectedBubble, setSelectedBubble] = useState<Interest | null>(null);
  const [fieldParticipants, setFieldParticipants] = useState<Participant[]>([]);

  const commonInterests = useMemo(
    () => buildCommonInterests(fieldParticipants, currentUserId),
    [fieldParticipants, currentUserId]
  );

  const resetSessionState = () => {
    setCurrentScreen('entry');
    setMode(null);
    setRoomCode('');
    setRoomCodeInput('');
    setCurrentUserId('');
    setFieldParticipants([]);
    setShowCommonGround(false);
    setSelectedBubble(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50">
      {currentScreen === 'entry' && (
        <EntryScreen
          nickname={nickname}
          setNickname={setNickname}
          roomCodeInput={roomCodeInput}
          setRoomCodeInput={setRoomCodeInput}
          setMode={setMode}
          onNavigate={setCurrentScreen}
        />
      )}

      {currentScreen === 'setup' && (
        <SetupScreen
          nickname={nickname}
          mode={mode}
          roomCodeInput={roomCodeInput}
          interests={myInterests}
          setInterests={setMyInterests}
          setCurrentUserId={setCurrentUserId}
          setRoomCode={setRoomCode}
          onNavigate={setCurrentScreen}
        />
      )}

      {currentScreen === 'lobby' && (
        <LobbyScreen
          roomCode={roomCode || roomCodeInput}
          currentUserId={currentUserId}
          setCurrentUserId={setCurrentUserId}
          onNavigate={setCurrentScreen}
          onResetSession={resetSessionState}
        />
      )}

      {currentScreen === 'field' && (
        <BubbleFieldScreen
          roomCode={roomCode || roomCodeInput}
          currentUserId={currentUserId}
          setCurrentUserId={setCurrentUserId}
          onParticipantsLoaded={setFieldParticipants}
          onShowCommonGround={() => setShowCommonGround(true)}
          selectedBubble={selectedBubble}
          setSelectedBubble={setSelectedBubble}
          onNavigate={setCurrentScreen}
          onResetSession={resetSessionState}
        />
      )}

      {currentScreen === 'recommendation' && (
        <RecommendationScreen
          commonInterests={commonInterests}
          participants={fieldParticipants}
          currentUserId={currentUserId}
          onExit={resetSessionState}
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
