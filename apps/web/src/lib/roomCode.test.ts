import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInviteLink, evaluateJoinability, normalizeRoomCode, parseInviteCodeFromPath } from './roomCode.ts';

test('방 코드는 공백 제거 + 대문자 + 6자로 정규화한다', () => {
  assert.equal(normalizeRoomCode('  ab c123 '), 'ABC123');
  assert.equal(normalizeRoomCode('abcdefgh'), 'ABCDEF');
  assert.equal(normalizeRoomCode('   '), '');
});

test('/join/:code 경로에서 코드를 읽는다', () => {
  assert.equal(parseInviteCodeFromPath('/join/abc123'), 'ABC123');
  assert.equal(parseInviteCodeFromPath('/join/ABC123/'), 'ABC123');
  assert.equal(parseInviteCodeFromPath('/'), null);
  assert.equal(parseInviteCodeFromPath('/join/'), null);
  assert.equal(parseInviteCodeFromPath('/rooms/ABC123'), null);
});

test('참여 가능 여부: 대기 중이고 6명 미만이면 OK', () => {
  const joined = (n: number) => Array.from({ length: n }, () => ({ status: 'joined' }));
  assert.deepEqual(evaluateJoinability({ room: { status: 'waiting' }, participants: joined(5) }), { ok: true });
  assert.equal(evaluateJoinability({ room: { status: 'waiting' }, participants: joined(6) }).ok, false);
  assert.equal(evaluateJoinability({ room: { status: 'started' }, participants: joined(2) }).ok, false);
});

test('나간 참여자는 정원에 포함하지 않는다', () => {
  const participants = [...Array.from({ length: 5 }, () => ({ status: 'joined' })), { status: 'left' }, { status: 'left' }];
  assert.deepEqual(evaluateJoinability({ room: { status: 'waiting' }, participants }), { ok: true });
});

test('초대 링크', () => {
  assert.equal(buildInviteLink('https://x.dev', 'ABC123'), 'https://x.dev/join/ABC123');
});
