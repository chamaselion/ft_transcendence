/*
 * End-to-end test for per-document permissions over the WebSocket, and for
 * what happens to a live connection when its session ends.
 *
 * Meant to run INSIDE the backend container (where `ws` is installed and
 * localhost:3001 is the backend itself):
 *
 *   bash scripts/test-websocket-sharing.sh
 *
 * Complements the two existing suites rather than repeating them:
 *   - scripts/test-document-sharing.sh covers the REST side of sharing
 *   - scripts/test-websocket.js covers plain live editing by a single owner
 * What is only observable here is the live behaviour: a viewer being refused
 * a write, a permission change reaching an already-open socket, and a
 * connection being closed when the share or the session goes away.
 *
 * Needs EMAIL_TRANSPORT=console in .env so the 2FA flow can be scripted.
 * Creates two throwaway users per run; deletes nothing else.
 */
const https = require('https');
const WebSocket = require('ws');

const HOST = 'localhost';
const PORT = Number(process.env.PORT || 3001);
const WS_URL = `wss://${HOST}:${PORT}/api/ws`;
const stamp = Date.now();

// Must match HEARTBEAT_INTERVAL_MS in ws/documentSocket.js. Only case 6 waits
// this long; override it if you shorten the interval while debugging.
const HEARTBEAT_MS = Number(process.env.WS_HEARTBEAT_MS || 30000);

// Case 6 needs an existing admin to promote and demote a throwaway account.
// Same defaults as scripts/test-document-sharing.sh.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'test@gmail.com';
const ADMIN_PASS = process.env.ADMIN_PASS || 'password123';

let pass = 0;
let fail = 0;
const check = (label, cond, extra) => {
  if (cond) {
    console.log(`  \x1b[32mok  \x1b[0m ${label}`);
    pass += 1;
  } else {
    console.log(`  \x1b[31mFAIL\x1b[0m ${label}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`);
    fail += 1;
  }
};

const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };

const request = (method, path, { body, cookie } = {}) =>
  new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        host: HOST, port: PORT, path, method, rejectUnauthorized: false,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      },
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

// Logs an *existing* account in through the 2FA flow and returns its cookie.
const signIn = async (email, password) => {
  const login = await request('POST', '/api/auth/login', { body: { email, password } });
  if (!login.json?.debugCode) {
    throw new Error(`No debugCode for ${email}. Is EMAIL_TRANSPORT=console set in .env?`);
  }

  const confirm = await request('POST', '/api/auth/login/confirm', {
    body: { challengeId: login.json.challengeId, email, code: login.json.debugCode },
  });
  const setCookie = (confirm.setCookie || []).find((c) => c.startsWith('token='));
  if (!setCookie) throw new Error(`2FA confirm did not set a cookie for ${email}`);

  return { email, cookie: setCookie.split(';')[0] };
};

// Registers a throwaway account and returns it, logged in.
const signUp = async (name) => {
  const user = { login: `${name}_${stamp}`, email: `${name}_${stamp}@example.com`, password: 'password123' };
  await request('POST', '/api/auth/register', { body: user });

  const session = await signIn(user.email, user.password);
  return { ...user, cookie: session.cookie };
};

// A socket that keeps every message it received, so a check never races the
// arrival of one. `ws` answers pings by itself, which is what keeps these
// connections alive past the heartbeat.
const connect = (cookie) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, { headers: { Cookie: cookie }, rejectUnauthorized: false });
    ws.inbox = [];
    ws.closed = false;
    ws.on('message', (raw) => ws.inbox.push(JSON.parse(raw.toString())));
    ws.on('close', () => { ws.closed = true; });
    ws.on('error', () => {});
    ws.on('open', () => resolve(ws));
    ws.once('error', reject);
  });

const send = (ws, msg) => ws.send(JSON.stringify(msg));
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const last = (ws) => ws.inbox[ws.inbox.length - 1];
const sawType = (ws, type) => ws.inbox.some((m) => m.type === type);

(async () => {
  console.log(`== Backend: https://${HOST}:${PORT}`);
  console.log('Setup: two throwaway users');
  const alice = await signUp('wsshare_a');
  const bob = await signUp('wsshare_b');

  const created = await request('POST', '/api/documents', {
    cookie: alice.cookie, body: { title: 'Shared doc', content: 'start' },
  });
  const docId = created.json?.document?.id;
  if (!docId) throw new Error(`Could not create a document: ${JSON.stringify(created.json)}`);
  console.log(`Setup: document ${docId}\n`);

  const aliceWs = await connect(alice.cookie);
  const bobWs = await connect(bob.cookie);

  // --- 1) no share, no room --------------------------------------------------
  console.log('1) Without a share, B cannot enter the room');
  send(aliceWs, { type: 'join', documentId: docId });
  send(bobWs, { type: 'join', documentId: docId });
  await settle();
  check("owner joins and gets permission 'owner'",
    last(aliceWs)?.type === 'init' && last(aliceWs)?.permission === 'owner', last(aliceWs));
  check('stranger is refused, and is not told the document exists',
    last(bobWs)?.error === 'Document not found', last(bobWs));
  console.log();

  // --- 2) viewer -------------------------------------------------------------
  console.log('2) B as viewer: may watch, may not write');
  const shared = await request('POST', `/api/documents/${docId}/shares`, {
    cookie: alice.cookie, body: { email: bob.email, permission: 'viewer' },
  });
  check('REST share -> 201', shared.status === 201, shared.json);

  send(bobWs, { type: 'join', documentId: docId });
  await settle();
  check("viewer joins and gets permission 'viewer'",
    last(bobWs)?.type === 'init' && last(bobWs)?.permission === 'viewer', last(bobWs));

  send(bobWs, { type: 'update', content: 'viewer tried to write' });
  await settle();
  check('viewer update is refused', last(bobWs)?.error === 'Read-only access', last(bobWs));

  let doc = await request('GET', `/api/documents/${docId}`, { cookie: alice.cookie });
  let storedText = doc.json?.document?.content;
  try {
    const blocks = JSON.parse(storedText);
    if (Array.isArray(blocks)) storedText = blocks.map((block) => block.text).join('\n');
  } catch {
    // Legacy plain-text documents are compared as-is.
  }
  check('and nothing was written', storedText === 'start', doc.json?.document?.content);
  console.log();

  // --- 3) live upgrade -------------------------------------------------------
  console.log('3) Upgrading to editor reaches the open socket');
  const upgraded = await request('POST', `/api/documents/${docId}/shares`, {
    cookie: alice.cookie, body: { email: bob.email, permission: 'editor' },
  });
  check('re-share upgrades instead of duplicating -> 200', upgraded.status === 200, upgraded.json);
  await settle();
  check('the open socket was told about the new level',
    last(bobWs)?.type === 'permission' && last(bobWs)?.permission === 'editor', last(bobWs));

  send(bobWs, { type: 'update', content: 'edited live by B' });
  await settle();
  check('editor update is broadcast to the owner',
    last(aliceWs)?.type === 'update' && last(aliceWs)?.content === 'edited live by B', last(aliceWs));

  doc = await request('GET', `/api/documents/${docId}`, { cookie: alice.cookie });
  check('and it was persisted', doc.json?.document?.content === 'edited live by B', doc.json?.document?.content);
  console.log();

  // --- 4) revocation ---------------------------------------------------------
  console.log('4) Revoking a share ends the live access at once');
  const bobId = (await request('GET', '/api/auth/me', { cookie: bob.cookie })).json?.user?.id;
  check('resolved B\'s id', Boolean(bobId), bobId);

  const revoked = await request('DELETE', `/api/documents/${docId}/shares/${bobId}`, { cookie: alice.cookie });
  check('REST revoke -> 204', revoked.status === 204, revoked.json);
  await settle();
  check('the open socket was told', sawType(bobWs, 'revoked'), bobWs.inbox.slice(-3));

  send(bobWs, { type: 'update', content: 'after the revoke' });
  await settle();
  check('a write after the revoke is refused',
    last(bobWs)?.error === 'Join a document first', last(bobWs));

  send(bobWs, { type: 'join', documentId: docId });
  await settle();
  check('and re-joining fails like any stranger',
    last(bobWs)?.error === 'Document not found', last(bobWs));

  doc = await request('GET', `/api/documents/${docId}`, { cookie: alice.cookie });
  check('the document is untouched', doc.json?.document?.content === 'edited live by B', doc.json?.document?.content);
  console.log();

  // --- 5) logout -------------------------------------------------------------
  // A socket authenticates once, at its handshake. Logging out has to reach it,
  // otherwise the connection outlives the session it was opened with.
  console.log('5) Logging out closes that session\'s live connection');
  await request('POST', `/api/documents/${docId}/shares`, {
    cookie: alice.cookie, body: { email: bob.email, permission: 'editor' },
  });
  const bobAgain = await connect(bob.cookie);
  send(bobAgain, { type: 'join', documentId: docId });
  await settle();
  check('B is back in the document', last(bobAgain)?.type === 'init', last(bobAgain));

  const loggedOut = await request('POST', '/api/auth/logout', { cookie: bob.cookie });
  check('REST logout -> 200', loggedOut.status === 200, loggedOut.json);
  await settle(500);
  check('the live connection was told', sawType(bobAgain, 'session_expired'), bobAgain.inbox.slice(-3));
  check('and it was closed', bobAgain.closed);
  check("the owner's connection is untouched", !aliceWs.closed);

  send(aliceWs, { type: 'update', content: 'owner still works' });
  await settle();
  doc = await request('GET', `/api/documents/${docId}`, { cookie: alice.cookie });
  check('the owner can still write', doc.json?.document?.content === 'owner still works', doc.json?.document?.content);
  console.log();

  // --- 6) a role change reaches an open room ---------------------------------
  // The one permission change the share endpoints cannot push: nothing under
  // /shares knows that somebody stopped being an admin. The socket therefore
  // re-resolves its own level on every heartbeat tick, and this is the case
  // that proves it - deliberately the only slow check in this file.
  console.log('6) Losing the admin role ends admin reach in an open room');

  const admin = await signIn(ADMIN_EMAIL, ADMIN_PASS).catch(() => null);
  const adminMe = admin && await request('GET', '/api/auth/me', { cookie: admin.cookie });

  if (adminMe?.json?.user?.role !== 'admin') {
    console.log(`  skipped: ${ADMIN_EMAIL} is not an admin account`);
    console.log('  (set ADMIN_EMAIL / ADMIN_PASS to one that is)');
    console.log();
  } else {
    const carol = await signUp('wsshare_c');
    const carolMe = await request('GET', '/api/auth/me', { cookie: carol.cookie });
    const carolId = carolMe.json?.user?.id;

    const promoted = await request('PATCH', `/api/users/${carolId}`, {
      cookie: admin.cookie, body: { role: 'admin' },
    });
    check('a third user is promoted to admin -> 200', promoted.status === 200, promoted.json);

    const carolWs = await connect(carol.cookie);
    send(carolWs, { type: 'join', documentId: docId });
    await settle();
    check("as admin she joins a document she neither owns nor is shared on",
      last(carolWs)?.type === 'init' && last(carolWs)?.permission === 'owner', last(carolWs));

    const demoted = await request('PATCH', `/api/users/${carolId}`, {
      cookie: admin.cookie, body: { role: 'user' },
    });
    check('demoted back to user -> 200', demoted.status === 200, demoted.json);

    // Nothing is pushed for this: the level was cached on the socket at join
    // time, so only the next tick can notice.
    console.log(`  (waiting ${Math.round(HEARTBEAT_MS / 1000)}s for one heartbeat tick)`);
    await settle(HEARTBEAT_MS + 5000);

    check('the heartbeat evicted the open socket', sawType(carolWs, 'revoked'), carolWs.inbox.slice(-3));

    send(carolWs, { type: 'update', content: 'ex-admin writes' });
    await settle();
    check('a write from the ex-admin is refused',
      last(carolWs)?.error === 'Join a document first', last(carolWs));

    doc = await request('GET', `/api/documents/${docId}`, { cookie: alice.cookie });
    check('the document is untouched', doc.json?.document?.content === 'owner still works', doc.json?.document?.content);

    carolWs.close();
    console.log();
  }

  aliceWs.close();
  bobWs.close();

  console.log('================================');
  console.log(`  PASS: ${pass}    FAIL: ${fail}`);
  console.log('================================');
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('\n' + (err && err.message ? err.message : err));
  process.exit(1);
});
