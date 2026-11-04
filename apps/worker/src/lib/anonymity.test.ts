import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anonymizeEvents,
  anonymizeParticipants,
  buildAnonIdMap,
  filterSummaryForViewer,
  resolveAnonTarget,
  visibleHostUserId,
} from './anonymity.ts';

const ROOM = 'room-1';
const rows = [
  { userId: 'u-host', participantId: 'p-1' },
  { userId: 'u-hana', participantId: 'p-2' },
  { userId: 'u-jun', participantId: 'p-3' },
  { userId: 'u-sora', participantId: 'p-4' },
];
const names: Record<string, string> = { 'u-host': '민지', 'u-hana': '하나', 'u-jun': '준', 'u-sora': '소라' };
const participants = rows.map((r, i) => ({
  userId: r.userId,
  nickname: names[r.userId],
  status: 'joined',
  isReady: i % 2,
  interests_json: JSON.stringify([{ interestId: `00000000-0000-4000-8000-00000000000${i}`, text: `관심사${i}`, level: 'deep1' }]),
}));

test('anonId 는 결정적이고, userId/participantId 와 무관한 불투명 값이다', async () => {
  const a = await buildAnonIdMap(ROOM, rows);
  const b = await buildAnonIdMap(ROOM, rows);
  assert.deepEqual([...a], [...b]);
  for (const [userId, anonId] of a) {
    assert.match(anonId, /^a_[0-9a-f]{24}$/);
    assert.ok(!anonId.includes(userId));
  }
  // 방이 다르면 같은 참여자라도 다른 anonId
  const other = await buildAnonIdMap('room-2', rows);
  assert.notEqual(a.get('u-hana'), other.get('u-hana'));
  // 참여자마다 서로 다름
  assert.equal(new Set(a.values()).size, rows.length);
});

test('대기실: 닉네임은 보이지만 다른 사람의 관심사는 숨긴다 (내 것은 유지)', async () => {
  const anonIds = await buildAnonIdMap(ROOM, rows);
  const out = anonymizeParticipants({ roomStatus: 'waiting', viewerUserId: 'u-hana', participants, anonIds });
  assert.deepEqual(out.map((p) => p.nickname), ['민지', '하나', '준', '소라']);
  assert.deepEqual(out.map((p) => p.userId), rows.map((r) => r.userId));
  for (const p of out) {
    if (p.userId === 'u-hana') assert.notEqual(p.interests_json, '[]');
    else assert.equal(p.interests_json, '[]');
  }
});

test('게임 중: 다른 사람의 닉네임/userId 는 어디에도 나오지 않는다', async () => {
  const anonIds = await buildAnonIdMap(ROOM, rows);
  const out = anonymizeParticipants({ roomStatus: 'started', viewerUserId: 'u-hana', participants, anonIds });
  const json = JSON.stringify(out);
  for (const secret of ['민지', '준', '소라', 'u-host', 'u-jun', 'u-sora', 'p-1', 'p-3', 'p-4']) {
    assert.ok(!json.includes(secret), `leaked: ${secret}`);
  }
  // 나는 그대로
  const me = out.find((p) => p.userId === 'u-hana');
  assert.equal(me?.nickname, '하나');
  // 다른 사람은 별칭 + anonId
  const others = out.filter((p) => p.userId !== 'u-hana');
  assert.equal(others.length, 3);
  assert.ok(others.every((p) => p.nickname.startsWith('익명 ') && p.userId.startsWith('a_') && p.isReady === 0));
  assert.equal(new Set(others.map((p) => p.nickname)).size, 3);
});

test('게임 중: 참여자 순서는 입장 순서가 아니라 anonId 순이다', async () => {
  const anonIds = await buildAnonIdMap(ROOM, rows);
  const out = anonymizeParticipants({ roomStatus: 'started', viewerUserId: null, participants, anonIds });
  const ids = out.map((p) => p.userId);
  assert.deepEqual(ids, [...ids].sort());
  // 로그인하지 않은 사람에게는 전원 익명
  assert.ok(out.every((p) => p.userId.startsWith('a_') && p.nickname.startsWith('익명 ')));
});

test('별칭은 같은 요청 안에서 안정적이다 (같은 입력 -> 같은 별칭)', async () => {
  const anonIds = await buildAnonIdMap(ROOM, rows);
  const a = anonymizeParticipants({ roomStatus: 'started', viewerUserId: 'u-hana', participants, anonIds });
  const b = anonymizeParticipants({ roomStatus: 'started', viewerUserId: 'u-hana', participants, anonIds });
  assert.deepEqual(a, b);
});

test('hostUserId 는 방장 본인에게만, 게임 중에는 다른 사람에게 숨긴다', () => {
  assert.equal(visibleHostUserId('waiting', 'u-host', 'u-hana'), 'u-host');
  assert.equal(visibleHostUserId('started', 'u-host', 'u-hana'), '');
  assert.equal(visibleHostUserId('started', 'u-host', null), '');
  assert.equal(visibleHostUserId('started', 'u-host', 'u-host'), 'u-host');
});

test('이벤트: 내 id 는 그대로, 상대 id 는 anonId 로 바꾼다', async () => {
  const anonIds = await buildAnonIdMap(ROOM, rows);
  const events = [
    { id: 'e1', sourceUserId: 'u-hana', targetUserId: 'u-host' },
    { id: 'e2', sourceUserId: 'u-jun', targetUserId: 'u-hana' },
  ];
  const out = anonymizeEvents(events, 'u-hana', anonIds);
  assert.equal(out[0].sourceUserId, 'u-hana');
  assert.equal(out[0].targetUserId, anonIds.get('u-host'));
  assert.equal(out[1].sourceUserId, anonIds.get('u-jun'));
  assert.equal(out[1].targetUserId, 'u-hana');
  assert.ok(!JSON.stringify(out).includes('u-host') && !JSON.stringify(out).includes('u-jun'));
});

test('대상 지정: anonId 만 허용하고 실제 userId 는 거부한다', async () => {
  const anonIds = await buildAnonIdMap(ROOM, rows);
  assert.equal(resolveAnonTarget(anonIds.get('u-host')!, 'u-hana', anonIds), 'u-host');
  assert.equal(resolveAnonTarget('u-host', 'u-hana', anonIds), null); // 실제 id 는 oracle 이 되므로 거부
  assert.equal(resolveAnonTarget(anonIds.get('u-hana')!, 'u-hana', anonIds), null); // 나 자신
  assert.equal(resolveAnonTarget('a_unknown', 'u-hana', anonIds), null);
});

test('요약: 내가 포함된 쌍의 mutual 만 남긴다', () => {
  const pairs = [
    { userAId: 'u-hana', userBId: 'u-host', items: [{ kind: 'mutual', t: '맛집' }, { kind: 'oneWay', t: '영화' }] },
    { userAId: 'u-jun', userBId: 'u-sora', items: [{ kind: 'mutual', t: '게임' }] }, // 남의 매칭
    { userAId: 'u-hana', userBId: 'u-jun', items: [{ kind: 'oneWay', t: '러닝' }] }, // 한쪽만 -> 제외
  ];
  const out = filterSummaryForViewer(pairs, 'u-hana');
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].items, [{ kind: 'mutual', t: '맛집' }]);
});
