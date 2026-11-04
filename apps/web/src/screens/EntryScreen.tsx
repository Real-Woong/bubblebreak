import { useEffect, useState } from 'react';
import type { Screen } from '../types/bubble';
import { Sparkles, Users, AlertCircle, Link2 } from 'lucide-react';
import { getRoom } from '../api/room';
import { ApiError } from '../api/errors';
import { evaluateJoinability, normalizeRoomCode, ROOM_CODE_LENGTH } from '../lib/roomCode';

// 로고 이미지
// 주의: 이 경로는 "현재 파일 위치" 기준 상대경로여야 함
import BubbleBreakLogo from '../components/image/logo/BubbleBreakLogo.png';

// Entry 화면에서 선택 가능한 모드
type EntryMode = 'create' | 'join';

export default function EntryScreen({
  nickname,
  setNickname,
  roomCodeInput,
  setRoomCodeInput,
  setMode,
  onNavigate,
  notice,
  onDismissNotice,
  inviteCode
}: {
  // 부모(App.tsx)에서 내려준 닉네임 상태
  nickname: string;

  // 닉네임 변경 함수
  setNickname: (value: string) => void;

  // 방 참여 시 사용하는 방 코드 입력값
  roomCodeInput: string;

  // 방 코드 변경 함수
  setRoomCodeInput: (value: string) => void;

  // create / join 선택값 저장
  setMode: (mode: EntryMode) => void;

  // 현재 화면 전환 함수
  onNavigate: (screen: Screen) => void;

  // 세션 만료 등으로 강제로 entry에 돌아왔을 때 보여줄 안내 문구
  notice?: string | null;

  // 안내 문구를 닫았을 때 호출
  onDismissNotice?: () => void;

  // /join/:code 초대 링크로 들어온 경우의 방 코드
  inviteCode?: string | null;
}) {
  // 방 존재/정원 확인 중 여부, 확인 실패 메시지
  const [isChecking, setIsChecking] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // 안내 문구는 잠깐 보여주고 자동으로 닫는다.
  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => {
      onDismissNotice?.();
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [notice, onDismissNotice]);

  const hasNickname = Boolean(nickname.trim());
  const normalizedCode = normalizeRoomCode(roomCodeInput);
  const isInvite = Boolean(inviteCode) && inviteCode === normalizedCode;

  // "방 만들기" 버튼 클릭
  const handleCreate = () => {
    // 닉네임이 비어 있으면 진행 막기
    if (!hasNickname) return;

    // 현재 흐름을 create로 저장
    setMode('create');

    // create도 setup을 먼저 거친다
    onNavigate('setup');
  };

  // "방 참여하기" 버튼 클릭: 관심사 입력 단계로 가기 전에 방 존재 여부/정원을 먼저 확인한다.
  const handleJoin = async () => {
    if (!hasNickname || !normalizedCode || isChecking) return;

    setIsChecking(true);
    setJoinError(null);

    try {
      const response = await getRoom(normalizedCode);
      const joinability = evaluateJoinability(response);

      if (!joinability.ok) {
        setJoinError(joinability.message);
        return;
      }

      setRoomCodeInput(normalizedCode);
      setMode('join');
      onNavigate('setup');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setJoinError('존재하지 않는 방 코드예요. 코드를 다시 확인해주세요.');
      } else {
        setJoinError(error instanceof Error ? error.message : '방 정보를 확인하지 못했어요');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const joinDisabled = !hasNickname || !normalizedCode || isChecking;

  return (
    <div className="min-h-screen px-5 pt-6 pb-8 flex">
      <div className="max-w-[375px] w-full mx-auto flex flex-col flex-1">
        {notice && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">{notice}</p>
          </div>
        )}

        {isInvite && (
          <div className="mb-4 bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3 flex items-start gap-2">
            <Link2 className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
            <p className="text-xs text-purple-800 leading-relaxed">
              초대받은 방이에요 (<span className="font-semibold tracking-wider">{inviteCode}</span>).
              닉네임만 입력하고 참여하세요.
            </p>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center">
          {/* 상단 브랜드 영역: 첫 화면에 CTA가 보이도록 로고를 작게 둔다 */}
          <div className="text-center">
            <div className="flex flex-col items-center gap-2">
              <img
                src={BubbleBreakLogo}
                alt="BubbleBreak logo"
                className="h-20 w-20 object-contain"
                draggable={false}
              />

              {/* 서비스 타이틀 */}
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                BubbleBreak
              </h1>

              {/* 서비스 한 줄 소개 */}
              <div className="space-y-1">
                <p className="text-base text-gray-700 leading-relaxed">
                  관심사로 자연스럽게 대화 시작하기
                </p>
                <p className="text-sm text-gray-600">
                  낯설지 않게, 부담 없이
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-6">
            {/* 닉네임 입력 */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 border border-purple-100/50 shadow-sm">
              <label htmlFor="nickname-input" className="block text-sm font-semibold text-gray-700 mb-2">
                닉네임
              </label>

              <input
                id="nickname-input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={12}
                placeholder="닉네임을 입력하세요"
                className="w-full bg-white border-2 border-purple-200 rounded-full px-4 py-3 text-sm focus:outline-none focus:border-purple-400"
              />
              {!hasNickname && (
                <p className="text-xs text-gray-600 mt-2 text-center">닉네임을 입력하면 시작할 수 있어요</p>
              )}
            </div>

            {/* 방 만들기: 닉네임만 있으면 setup으로 이동 */}
            <button
              onClick={handleCreate}
              disabled={!hasNickname}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-full font-semibold text-base shadow-lg shadow-purple-200/50 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              방 만들기
            </button>

            {/* 방 참여하기 전용 방 코드 입력 */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 border border-purple-100/50 shadow-sm">
              <input
                value={roomCodeInput}
                onChange={(e) => {
                  setRoomCodeInput(normalizeRoomCode(e.target.value));
                  setJoinError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void handleJoin();
                  }
                }}
                maxLength={ROOM_CODE_LENGTH}
                aria-label="방 코드"
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="참여 시 방 코드를 입력하세요"
                className="w-full bg-white border-2 border-purple-200 rounded-full px-4 py-3 text-sm focus:outline-none focus:border-purple-400"
              />

              {joinError ? (
                <p role="alert" className="text-xs text-red-600 mt-2 text-center">
                  {joinError}
                </p>
              ) : (
                <p className="text-xs text-gray-600 mt-2 text-center">
                  {normalizedCode ? '방 코드를 확인하고 참여해요' : '방 코드를 입력하면 참여할 수 있어요'}
                </p>
              )}
            </div>

            {/* 방 참여하기: 닉네임 + 방 코드가 있어야 하고, 클릭 시 방 존재/정원을 확인한다 */}
            <button
              onClick={() => {
                void handleJoin();
              }}
              disabled={joinDisabled}
              className={`w-full py-4 rounded-full font-semibold text-base active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed ${
                isInvite
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-200/50'
                  : 'bg-white/80 backdrop-blur-sm text-purple-700 border-2 border-purple-200'
              }`}
            >
              {isChecking ? '방 확인 중...' : '방 참여하기'}
            </button>
          </div>

          {/* 기능 소개 카드는 CTA 아래로 내려서 첫 화면에 버튼이 보이도록 한다 */}
          <div className="space-y-3 mt-8">
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 border border-purple-100/50 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1 pt-1">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">
                    3단계 관심사 시스템
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    공개부터 비공개까지, 내가 선택하는 깊이
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 border border-purple-100/50 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1 pt-1">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">
                    최대 6명의 소규모 룸
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    부담 없는 인원, 편안한 분위기
                  </p>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-gray-600 pt-1">
              💾 계정 없이, 가볍게 시작해요
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
