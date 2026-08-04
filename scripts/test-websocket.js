/*
 * End-to-end WebSocket test. Meant to run INSIDE the backend container
 * (where `ws` is installed and localhost:3001 is the backend itself):
 *
 *   bash scripts/test-websocket.sh
 *
 * It registers a user, logs in (2FA), creates a document, opens two
 * WebSocket clients on the same document, edits from one and verifies the
 * other receives the change live and that it was persisted.
 */
const http = require('http');
const WebSocket = require('ws');

const BASE_HOST = 'localhost';
const BASE_PORT = Number(process.env.PORT || 3001);
const WS_URL = `ws://${BASE_HOST}:${BASE_PORT}/api/ws`;

const stamp = Date.now();
const USER = { login: `wstester_${stamp}`, email: `wstester_${stamp}@example.com`, password: 'password123' };

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
  let step = '';
  const check = (cond, msg) => { if (!cond) throw new Error(`FAILED: ${msg}`); console.log('  ok -', msg); };

  step = 'register'; await request('POST', '/api/auth/register', { body: USER });

  step = 'login';
  const login = await request('POST', '/api/auth/login', { body: { email: USER.email, password: USER.password } });
  const challengeId = login.json?.challengeId;
  const code = login.json?.debugCode;
  check(challengeId && code, 'login returned challengeId + debug code');

  step = 'confirm';
  const confirm = await request('POST', '/api/auth/login/confirm', { body: { challengeId, email: USER.email, code } });
  const setCookie = (confirm.setCookie || []).find((c) => c.startsWith('token='));
  check(!!setCookie, '2FA confirm set the login cookie');
  const cookie = setCookie.split(';')[0]; // "token=xxx"

  step = 'create document';
  const created = await request('POST', '/api/documents', { cookie, body: { title: 'WS Doc', content: 'start' } });
  const docId = created.json?.document?.id;
  check(created.status === 201 && docId, 'document created');

  step = 'connect two clients';
  const a = new WebSocket(WS_URL, { headers: { Cookie: cookie } });
  const b = new WebSocket(WS_URL, { headers: { Cookie: cookie } });
  await Promise.all([open(a), open(b)]);
  check(true, 'two WebSocket clients connected (wss auth via cookie)');

  step = 'join';
  a.send(JSON.stringify({ type: 'join', documentId: docId }));
  const initA = await nextMessage(a);
  b.send(JSON.stringify({ type: 'join', documentId: docId }));
  const initB = await nextMessage(b);
  check(initA.type === 'init' && initB.type === 'init', 'both clients joined and got init');

  step = 'live edit';
  const bGetsUpdate = nextMessage(b);
  a.send(JSON.stringify({ type: 'update', content: 'edited live by A' }));
  const upd = await bGetsUpdate;
  check(upd.type === 'update' && upd.content === 'edited live by A', 'client B received the edit live');

  step = 'persistence';
  const fetched = await request('GET', `/api/documents/${docId}`, { cookie });
  check(fetched.json?.document?.content === 'edited live by A', 'edit was persisted to the database');

  a.close(); b.close();
  console.log('\nAll WebSocket checks passed.');
  process.exit(0);
})().catch((err) => { console.error('\n' + err.message); process.exit(1); });
