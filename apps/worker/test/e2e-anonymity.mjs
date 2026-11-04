// 익명화 End-to-End 테스트: 실제 Worker 코드를 Node 내장 SQLite(node:sqlite)를 D1 대신 써서 통째로 실행한다.
// 실행: yarn test:e2e  (Node 22+)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [join(here, '../src/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(here, '.tmp/worker.bundle.mjs'),
  logLevel: 'error',
});
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const { default: worker } = await import('./.tmp/worker.bundle.mjs');

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
const wrap = (sql) => {
  let args = [];
  const st = db.prepare(sql);
  const api = {
    bind: (...a) => { args = a; return api; },
    first: async () => st.get(...args) ?? null,
    all: async () => ({ results: st.all(...args) }),
    run: async () => { const r = st.run(...args); return { success: true, meta: { changes: r.changes } }; },
  };
  return api;
};
const env = { DB: { prepare: wrap }, ASSETS: { fetch: async () => new Response('x') } };

class Client {
  constructor(name) { this.name = name; this.cookie = ''; }
  async call(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.cookie) headers.Cookie = this.cookie;
    const res = await worker.fetch(new Request('https://x.dev' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
    const sc = res.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  }
}
const ok = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok  :', m); };

{
const host = new Client('민지'), hana = new Client('하나'), jun = new Client('준');
const created = (await host.call('POST', '/rooms', { nickname: '민지', interests: [{ text: '맛집', level: 'deep1' }, { text: '덕질', level: 'deep3' }] })).json;
const code = created.roomCode;
const hj = (await hana.call('POST', `/rooms/${code}/join`, { nickname: '하나', interests: [{ text: '맛집', level: 'deep1' }] })).json;
const jj = (await jun.call('POST', `/rooms/${code}/join`, { nickname: '준', interests: [{ text: '게임', level: 'deep1' }] })).json;

// 1) 대기실: 닉네임 보이고, 남의 관심사는 숨김
let r = (await hana.call('GET', `/rooms/${code}`)).json;
ok(r.participants.map(p => p.nickname).sort().join() === '민지,준,하나'.split(',').sort().join(), '대기실: 닉네임 표시');
ok(r.participants.filter(p => p.userId !== hj.userId).every(p => p.interests_json === '[]'), '대기실: 남의 관심사 숨김');
ok(JSON.parse(r.participants.find(p => p.userId === hj.userId).interests_json).length === 1, '대기실: 내 관심사 유지');
ok(r.room.hostUserId === created.userId, '대기실: hostUserId 표시');
const outsider = (await new Client('x').call('GET', `/rooms/${code}`)).json;
ok(outsider.participants.every(p => p.interests_json === '[]'), '대기실: 외부인에게도 관심사 숨김');

// 2) 시작
await hana.call('POST', `/rooms/${code}/ready`); await jun.call('POST', `/rooms/${code}/ready`);
const st = await host.call('POST', `/rooms/${code}/start`);
ok(st.status === 200, '방 시작');

// 3) 게임 중: 하나 관점
r = (await hana.call('GET', `/rooms/${code}`)).json;
const dump = JSON.stringify(r);
for (const secret of ['민지', '준', created.userId, jj.userId]) ok(!dump.includes(secret), `필드 응답에 노출 없음: ${secret}`);
ok(r.participants.find(p => p.userId === hj.userId)?.nickname === '하나', '필드: 내 정보는 그대로');
ok(r.room.hostUserId === '', '필드: 방장 id 숨김 (게스트)');
const hostView = (await host.call('GET', `/rooms/${code}`)).json;
ok(hostView.room.hostUserId === created.userId, '필드: 방장 본인에게는 hostUserId');
const others = r.participants.filter(p => p.userId !== hj.userId);
ok(others.length === 2 && others.every(p => p.userId.startsWith('a_') && p.nickname.startsWith('익명 ')), '필드: 남은 둘은 별칭 + anonId');
ok(!others.some(p => dump.includes(JSON.parse(p.interests_json)[0]?.interestId ?? 'zzz') === false), '필드: 관심사는 보임(대상 선택 가능)');

// 4) 실제 userId 로 pop → 거부, anonId 로 pop → 성공
const hostAnon = others.find(p => JSON.parse(p.interests_json).some(i => i.text === '맛집'));
const hostInterest = JSON.parse(hostAnon.interests_json).find(i => i.text === '맛집');
let p1 = await hana.call('POST', `/rooms/${code}/pop`, { targetUserId: created.userId, interestId: hostInterest.interestId });
ok(p1.status === 404, `실제 userId 로 pop 거부 (status ${p1.status})`);
p1 = await hana.call('POST', `/rooms/${code}/pop`, { targetUserId: hostAnon.userId, interestId: hostInterest.interestId });
ok(p1.status === 200, `anonId 로 pop 성공 (status ${p1.status})`);

// 5) 민지(방장)도 하나의 맛집을 anonId 로 pop → mutual
const hv = (await host.call('GET', `/rooms/${code}`)).json;
const hanaAnon = hv.participants.find(p => p.nickname.startsWith('익명') && JSON.parse(p.interests_json).some(i => i.text === '맛집'));
const hanaInterest = JSON.parse(hanaAnon.interests_json).find(i => i.text === '맛집');
const p2 = await host.call('POST', `/rooms/${code}/pop`, { targetUserId: hanaAnon.userId, interestId: hanaInterest.interestId });
ok(p2.status === 200, '방장이 anonId 로 pop');

// 6) 이벤트: 상대 id 는 anonId
const ev = (await hana.call('GET', `/rooms/${code}/events`)).json;
ok(ev.events.length >= 1 && !JSON.stringify(ev).includes(created.userId), '이벤트에 실제 userId 노출 없음');
ok(ev.events.every(e => e.sourceUserId === hj.userId || e.sourceUserId.startsWith('a_')), '이벤트 source 가 내 id 또는 anonId');

// 7) 요약
await host.call('POST', `/rooms/${code}/finish`);
const sm = (await hana.call('GET', `/rooms/${code}/summary`)).json;
ok(sm.pairs.length === 1 && sm.pairs[0].items.length === 1 && sm.pairs[0].items[0].kind === 'mutual', '요약: 내 mutual 1건');
ok(JSON.stringify(sm).includes('민지'), '요약: 실제 닉네임 공개');
const smJun = (await jun.call('GET', `/rooms/${code}/summary`)).json;
ok(smJun.pairs.length === 0, '요약: 관련 없는 사람에게는 빈 결과 (남의 매칭 숨김)');
ok(!JSON.stringify(smJun).includes('맛집'), '요약: 남의 관심사 노출 없음');

}
console.log("--- deep3 ---");
{
const host = new Client('민지'), hana = new Client('하나');
const created = (await host.call('POST', '/rooms', { nickname: '민지', interests: [{ text: '맛집', level: 'deep1' }, { text: '덕질', level: 'deep3' }] })).json;
const code = created.roomCode;
const hj = (await hana.call('POST', `/rooms/${code}/join`, { nickname: '하나', interests: [{ text: '게임', level: 'deep1' }] })).json;
await hana.call('POST', `/rooms/${code}/ready`);
await host.call('POST', `/rooms/${code}/start`);

let r = (await hana.call('GET', `/rooms/${code}`)).json;
const hostAnon = r.participants.find(p => p.userId !== hj.userId);
const secret = JSON.parse(hostAnon.interests_json).find(i => i.level === 'deep3');
ok(secret.text === '비공개 관심사', 'deep3: 요청 전에는 텍스트 비공개');

const rq = await hana.call('POST', `/rooms/${code}/deep3-request`, { targetUserId: hostAnon.userId, interestId: secret.interestId });
ok(rq.status === 200, `deep3: anonId 로 요청 (status ${rq.status})`);
const rqReal = await hana.call('POST', `/rooms/${code}/deep3-request`, { targetUserId: created.userId, interestId: secret.interestId });
ok(rqReal.status === 404, `deep3: 실제 userId 로 요청 거부 (status ${rqReal.status})`);

const hostEvents = (await host.call('GET', `/rooms/${code}/events`)).json.events;
const pending = hostEvents.find(e => e.eventType === 'deep3_request');
ok(pending && pending.sourceUserId.startsWith('a_') && !JSON.stringify(hostEvents).includes(hj.userId), 'deep3: 방장이 보는 요청자는 anonId');
const ap = await host.call('POST', `/rooms/${code}/deep3-request/${pending.id}/approve`);
ok(ap.status === 200, `deep3: 수락 (status ${ap.status})`);

r = (await hana.call('GET', `/rooms/${code}`)).json;
const after = JSON.parse(r.participants.find(p => p.userId !== hj.userId).interests_json).find(i => i.level === 'deep3');
ok(after.text === '덕질', 'deep3: 수락 후 요청자에게만 텍스트 공개');
const hostSees = (await host.call('GET', `/rooms/${code}`)).json;
ok(JSON.stringify(hostSees).includes('하나') === false, 'deep3: 방장 응답에도 하나의 닉네임 없음');

}
