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
const open = (ws) => new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });

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

  // 9. Verify persistence in DB
  const fetched = await request('GET', `/api/documents/${docId}`, { cookie });
  const parsedContent = JSON.parse(fetched.json?.document?.content || '[]');
  check(
    parsedContent.length === 1 && parsedContent[0].id === 'b2' && parsedContent[0].text === 'Second block updated by B',
    'final block state persisted correctly in PostgreSQL database',
  );

  a.close();
  b.close();
  console.log('\nAll block WebSocket tests passed successfully!');
  process.exit(0);
})().catch((err) => {
  console.error('\n' + (err && err.message ? err.message : err));
  process.exit(1);
});
