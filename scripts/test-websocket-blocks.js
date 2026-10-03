/*
 * End-to-end test for block-based WebSocket editing.
 * Meant to run inside the backend container:
 *   bash scripts/test-websocket-blocks.sh
 */
const http = require('http');
const WebSocket = require('ws');

const BASE_HOST = 'localhost';
const BASE_PORT = Number(process.env.PORT || 3001);
const WS_URL = `ws://${BASE_HOST}:${BASE_PORT}/api/ws`;

const stamp = Date.now();
const USER = { login: `blocktester_${stamp}`, email: `blocktester_${stamp}@example.com`, password: 'password123' };

function request(method, path, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: BASE_HOST, port: BASE_PORT, path, method,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) } },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, setCookie: res.headers['set-cookie'], json: safeJson(raw) }));
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}
const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };
const nextMessage = (ws) => new Promise((r) => ws.once('message', (m) => r(JSON.parse(m.toString()))));
const nextMessageWhere = (ws, predicate, timeoutMs = 3000) =>
  new Promise((resolve, reject) => {
    const onMessage = (m) => {
      const parsed = JSON.parse(m.toString());
      if (predicate(parsed)) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve(parsed);
      }
    };
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('timed out waiting for a matching message'));
    }, timeoutMs);
    ws.on('message', onMessage);
  });
const open = (ws) => new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });

const loginUser = async (prefix) => {
  const user = { login: `${prefix}_${stamp}`, email: `${prefix}_${stamp}@example.com`, password: 'password123' };
  await request('POST', '/api/auth/register', { body: user });
  const login = await request('POST', '/api/auth/login', { body: { email: user.email, password: user.password } });
  const confirm = await request('POST', '/api/auth/login/confirm', {
    body: { challengeId: login.json?.challengeId, email: user.email, code: login.json?.debugCode },
  });
  const setCookie = (confirm.setCookie || []).find((c) => c.startsWith('token='));
  return { user, cookie: setCookie.split(';')[0] };
};

(async () => {
  const check = (cond, msg) => { if (!cond) throw new Error(`FAILED: ${msg}`); console.log('  ok -', msg); };

  // 1. Auth setup
  await request('POST', '/api/auth/register', { body: USER });
  const login = await request('POST', '/api/auth/login', { body: { email: USER.email, password: USER.password } });
  const challengeId = login.json?.challengeId;
  const code = login.json?.debugCode;
  check(challengeId && code, 'login returned challengeId + debug code');

  const confirm = await request('POST', '/api/auth/login/confirm', { body: { challengeId, email: USER.email, code } });
  const setCookie = (confirm.setCookie || []).find((c) => c.startsWith('token='));
  check(!!setCookie, '2FA confirm set the login cookie');
  const cookie = setCookie.split(';')[0];

  // 2. Create document
  const initialBlocks = [
    { id: 'b1', text: 'First block', decorator: '{"type":"h","level":1}', lockedBy: null },
  ];
  const created = await request('POST', '/api/documents', {
    cookie,
    body: { title: 'Block Doc', content: JSON.stringify(initialBlocks) },
  });
  const docId = created.json?.document?.id;
  check(created.status === 201 && docId, 'document created with initial blocks');

  // 3. Connect two clients
  const a = new WebSocket(WS_URL, { headers: { Cookie: cookie } });
  const b = new WebSocket(WS_URL, { headers: { Cookie: cookie } });
  await Promise.all([open(a), open(b)]);
  check(true, 'two clients connected over websocket');

  // 4. Join room
  a.send(JSON.stringify({ type: 'join', documentId: docId }));
  const initA = await nextMessage(a);
  b.send(JSON.stringify({ type: 'join', documentId: docId }));
  const initB = await nextMessage(b);
  check(initA.type === 'init' && initB.type === 'init', 'both clients joined document room');

  // 5. block_create
  const bGetsCreate = nextMessage(b);
  const newBlock = { id: 'b2', text: 'Second block added live', decorator: '{"type":"p"}', lockedBy: null };
  a.send(JSON.stringify({
    type: 'block_create',
    documentId: docId,
    block: newBlock,
    afterBlockId: 'b1',
  }));
  const createdMsg = await bGetsCreate;
  check(
    createdMsg.type === 'block_created' && createdMsg.block?.id === 'b2' && createdMsg.afterBlockId === 'b1',
    'client B received block_created event live',
  );

  // 6. block_edit
  const aGetsEdit = nextMessage(a);
  b.send(JSON.stringify({
    type: 'block_edit',
    documentId: docId,
    blockId: 'b2',
    text: 'Second block updated by B',
  }));
  const editMsg = await aGetsEdit;
  check(
    editMsg.type === 'block_updated' && editMsg.blockId === 'b2' && editMsg.text === 'Second block updated by B',
    'client A received block_updated event live',
  );

  // 7. block_lock and block_unlock
  const aGetsLock = nextMessage(a);
  b.send(JSON.stringify({
    type: 'block_lock',
    documentId: docId,
    blockId: 'b2',
    clientId: 'client-b-uuid',
  }));
  const lockMsg = await aGetsLock;
  check(
    lockMsg.type === 'block_locked' && lockMsg.blockId === 'b2' && lockMsg.clientId === 'client-b-uuid',
    'client A received block_locked event live',
  );

  const aGetsUnlock = nextMessage(a);
  b.send(JSON.stringify({
    type: 'block_unlock',
    documentId: docId,
    blockId: 'b2',
    clientId: 'client-b-uuid',
  }));
  const unlockMsg = await aGetsUnlock;
  check(
    unlockMsg.type === 'block_unlocked' && unlockMsg.blockId === 'b2' && unlockMsg.clientId === 'client-b-uuid',
    'client A received block_unlocked event live',
  );

  // 8. block_delete
  const bGetsDelete = nextMessage(b);
  a.send(JSON.stringify({
    type: 'block_delete',
    documentId: docId,
    blockId: 'b1',
  }));
  const deleteMsg = await bGetsDelete;
  check(
    deleteMsg.type === 'block_deleted' && deleteMsg.blockId === 'b1',
    'client B received block_deleted event live',
  );

  // 9. title_update
  const bGetsTitle = nextMessage(b);
  a.send(JSON.stringify({
    type: 'title_update',
    documentId: docId,
    title: 'Renamed Document Title',
  }));
  const titleMsg = await bGetsTitle;
  check(
    titleMsg.type === 'title_updated' && titleMsg.title === 'Renamed Document Title',
    'client B received title_updated event live',
  );

  // 10. Verify persistence in DB
  const fetched = await request('GET', `/api/documents/${docId}`, { cookie });
  const parsedContent = JSON.parse(fetched.json?.document?.content || '[]');
  check(
    parsedContent.length === 1 && parsedContent[0].id === 'b2' && parsedContent[0].text === 'Second block updated by B',
    'final block state persisted correctly in PostgreSQL database',
  );
  check(
    fetched.json?.document?.title === 'Renamed Document Title',
    'renamed title persisted correctly in PostgreSQL database',
  );

  // 11. Authorization: viewers cannot lock or edit; locks are enforced against other editors
  const viewer = await loginUser('blockviewer');
  const shareStatus = await request('POST', `/api/documents/${docId}/shares`, {
    cookie,
    body: { email: viewer.user.email, permission: 'viewer' },
  });
  check(shareStatus.status === 201, 'viewer share created');

  const v = new WebSocket(WS_URL, { headers: { Cookie: viewer.cookie } });
  await open(v);
  v.send(JSON.stringify({ type: 'join', documentId: docId }));
  const initV = await nextMessageWhere(v, (m) => m.type === 'init');
  check(initV.type === 'init', 'viewer joined document room');

  const vLockError = nextMessageWhere(v, (m) => m.type === 'error');
  v.send(JSON.stringify({ type: 'block_lock', documentId: docId, blockId: 'b2', clientId: 'viewer-client' }));
  const vLockErrMsg = await vLockError;
  check(vLockErrMsg.error === 'Read-only access', 'viewer block_lock rejected with Read-only access');
  const noLockForA = await nextMessageWhere(a, (m) => m.type === 'block_locked' && m.blockId === 'b2', 1000).catch(() => null);
  check(noLockForA === null, 'no block_locked broadcast for a rejected viewer lock');

  const vEditError = nextMessageWhere(v, (m) => m.type === 'error');
  v.send(JSON.stringify({ type: 'block_edit', documentId: docId, blockId: 'b2', text: 'viewer overwrite' }));
  const vEditErrMsg = await vEditError;
  check(vEditErrMsg.error === 'Read-only access', 'viewer block_edit rejected with Read-only access');

  const aSeesBLock = nextMessageWhere(a, (m) => m.type === 'block_locked' && m.blockId === 'b2');
  b.send(JSON.stringify({ type: 'block_lock', documentId: docId, blockId: 'b2', clientId: 'client-b-uuid' }));
  await aSeesBLock;
  const aEditError = nextMessageWhere(a, (m) => m.type === 'error');
  a.send(JSON.stringify({ type: 'block_edit', documentId: docId, blockId: 'b2', text: 'bypass attempt' }));
  const aEditErrMsg = await aEditError;
  check(aEditErrMsg.error === 'Block is locked by another user', 'block_edit rejected while locked by another client');
  const aSeesBUnlock = nextMessageWhere(a, (m) => m.type === 'block_unlocked' && m.blockId === 'b2');
  b.send(JSON.stringify({ type: 'block_unlock', documentId: docId, blockId: 'b2', clientId: 'client-b-uuid' }));
  await aSeesBUnlock;
  v.close();

  // 12. Concurrent edits to different blocks must both persist (lost-update regression)
  const blocks2 = [
    { id: 'c1', text: 'one', decorator: '{"type":"p"}', lockedBy: null },
    { id: 'c2', text: 'two', decorator: '{"type":"p"}', lockedBy: null },
  ];
  const created2 = await request('POST', '/api/documents', {
    cookie,
    body: { title: 'Concurrent Doc', content: JSON.stringify(blocks2) },
  });
  const docId2 = created2.json?.document?.id;
  const a2 = new WebSocket(WS_URL, { headers: { Cookie: cookie } });
  const b2 = new WebSocket(WS_URL, { headers: { Cookie: cookie } });
  await Promise.all([open(a2), open(b2)]);
  a2.send(JSON.stringify({ type: 'join', documentId: docId2 }));
  await nextMessageWhere(a2, (m) => m.type === 'init');
  b2.send(JSON.stringify({ type: 'join', documentId: docId2 }));
  await nextMessageWhere(b2, (m) => m.type === 'init');

  for (let i = 0; i < 10; i++) {
    a2.send(JSON.stringify({ type: 'block_edit', documentId: docId2, blockId: 'c1', text: `A${i}` }));
    b2.send(JSON.stringify({ type: 'block_edit', documentId: docId2, blockId: 'c2', text: `B${i}` }));
  }
  await new Promise((r) => setTimeout(r, 1500));

  const fetched2 = await request('GET', `/api/documents/${docId2}`, { cookie });
  const parsed2 = JSON.parse(fetched2.json?.document?.content || '[]');
  const c1Block = parsed2.find((blk) => blk.id === 'c1');
  const c2Block = parsed2.find((blk) => blk.id === 'c2');
  check(c1Block && c1Block.text === 'A9', 'concurrent edit to block c1 persisted (A9)');
  check(c2Block && c2Block.text === 'B9', 'concurrent edit to block c2 persisted (B9)');
  a2.close();
  b2.close();

  // 13. Empty documents become editable after normalization on join
  const emptyDoc = await request('POST', '/api/documents', { cookie, body: { title: 'Empty Doc' } });
  const emptyId = emptyDoc.json?.document?.id;
  const a3 = new WebSocket(WS_URL, { headers: { Cookie: cookie } });
  await open(a3);
  a3.send(JSON.stringify({ type: 'join', documentId: emptyId }));
  const init3 = await nextMessageWhere(a3, (m) => m.type === 'init');
  const init3Blocks = JSON.parse(init3.document.content);
  check(Array.isArray(init3Blocks) && init3Blocks.length === 1, 'empty document normalized to a single block on join');
  const blockId3 = init3Blocks[0].id;
  a3.send(JSON.stringify({ type: 'block_edit', documentId: emptyId, blockId: blockId3, text: 'now editable' }));
  await new Promise((r) => setTimeout(r, 300));
  const fetched3 = await request('GET', `/api/documents/${emptyId}`, { cookie });
  const parsed3 = JSON.parse(fetched3.json?.document?.content || '[]');
  check(parsed3.length === 1 && parsed3[0].text === 'now editable', 'empty document became editable and persisted');
  a3.close();

  // 14. Plain text containing & and < is stored losslessly (no HTML entity encoding)
  const a4 = new WebSocket(WS_URL, { headers: { Cookie: cookie } });
  await open(a4);
  a4.send(JSON.stringify({ type: 'join', documentId: docId }));
  await nextMessageWhere(a4, (m) => m.type === 'init');
  a4.send(JSON.stringify({ type: 'block_edit', documentId: docId, blockId: 'b2', text: 'R&D and x < y' }));
  await new Promise((r) => setTimeout(r, 300));
  const fetched4 = await request('GET', `/api/documents/${docId}`, { cookie });
  const parsed4 = JSON.parse(fetched4.json?.document?.content || '[]');
  const b2Block = parsed4.find((blk) => blk.id === 'b2');
  check(b2Block && b2Block.text === 'R&D and x < y', 'text with & and < stored losslessly');
  a4.close();

  a.close();
  b.close();
  console.log('\nAll block WebSocket tests passed successfully!');
  process.exit(0);
})().catch((err) => {
  console.error('\n' + (err && err.message ? err.message : err));
  process.exit(1);
});
