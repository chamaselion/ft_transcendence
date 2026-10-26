/*
 * End-to-end reconnect/sync test. Run INSIDE the backend container:
 *
 *   bash scripts/test-websocket-reconnect.sh
 *
 * It verifies the content-hash handshake, the unchanged fast path, batched
 * sync operations, stale-fingerprint conflicts, and title-only reconnects.
 */
const https = require('https');
const crypto = require('crypto');
const WebSocket = require('ws');

const BASE_HOST = 'localhost';
const BASE_PORT = Number(process.env.PORT || 3001);
const WS_URL = `wss://${BASE_HOST}:${BASE_PORT}/api/ws`;
const stamp = Date.now();
const USER = {
  login: `wsreconnect_${stamp}`,
  email: `wsreconnect_${stamp}@example.com`,
  password: 'password123',
};

const HTML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
};

const unescapeHtml = (value) =>
  typeof value === 'string'
    ? value.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (entity) => HTML_ENTITIES[entity])
    : value;

const canonicalBlock = (block) => [
  typeof block?.id === 'string' ? block.id : '',
  unescapeHtml(typeof block?.text === 'string' ? block.text : ''),
  typeof block?.decorator === 'string' ? block.decorator : '',
];
const fingerprintBlock = (block) =>
  crypto.createHash('sha256').update(JSON.stringify(canonicalBlock(block))).digest('hex');
const hashBlocks = (blocks) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(blocks.map(canonicalBlock)))
    .digest('hex');

const request = (method, path, { body, cookie } = {}) =>
  new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        host: BASE_HOST,
        rejectUnauthorized: false,
        port: BASE_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            setCookie: res.headers['set-cookie'],
            json: safeJson(raw),
          }),
        );
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });

const safeJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const open = (ws) =>
  new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

const nextMessage = (ws) =>
  new Promise((resolve) => ws.once('message', (message) => resolve(JSON.parse(message.toString()))));

const connect = async (cookie) => {
  const ws = new WebSocket(WS_URL, {
    headers: { Cookie: cookie },
    rejectUnauthorized: false,
  });
  await open(ws);
  return ws;
};

const join = async (ws, documentId, hashes = {}) => {
  const response = nextMessage(ws);
  ws.send(JSON.stringify({ type: 'join', documentId, ...hashes }));
  return response;
};

const parseBlocks = (message) =>
  message.document?.content ? JSON.parse(message.document.content) : [];

(async () => {
  const check = (condition, message) => {
    if (!condition) throw new Error(`FAILED: ${message}`);
    console.log('  ok -', message);
  };

  await request('POST', '/api/auth/register', { body: USER });

  const login = await request('POST', '/api/auth/login', {
    body: { email: USER.email, password: USER.password },
  });
  const challengeId = login.json?.challengeId;
  const code = login.json?.debugCode;
  check(challengeId && code, 'login returned challengeId + debug code');

  const confirm = await request('POST', '/api/auth/login/confirm', {
    body: { challengeId, email: USER.email, code },
  });
  const setCookie = (confirm.setCookie || []).find((cookie) => cookie.startsWith('token='));
  check(Boolean(setCookie), '2FA confirm set the login cookie');
  const cookie = setCookie.split(';')[0];

  const initialBlocks = [
    { id: 'reconnect-block-1', text: 'initial text', decorator: '{"type":"p"}', lockedBy: null },
  ];
  const created = await request('POST', '/api/documents', {
    cookie,
    body: { title: 'Reconnect doc', content: JSON.stringify(initialBlocks) },
  });
  const documentId = created.json?.document?.id;
  check(created.status === 201 && Boolean(documentId), 'document created');

  const first = await connect(cookie);
  const firstInit = await join(first, documentId);
  const baseHash = firstInit.contentHash;
  const baseBlocks = parseBlocks(firstInit);
  check(firstInit.type === 'init' && !firstInit.unchanged, 'initial join returns full content');
  check(baseHash === hashBlocks(baseBlocks), 'server content hash matches canonical block hash');
  const blockId = baseBlocks[0].id;

  first.close();

  const second = await connect(cookie);
  const secondInit = await join(second, documentId);
  check(!secondInit.unchanged, 'second client receives full content');
  const secondBlocks = parseBlocks(secondInit);
  const secondExpected = fingerprintBlock(secondBlocks[0]);
  const secondEdit = nextMessage(second);
  second.send(
    JSON.stringify({
      type: 'sync',
      documentId,
      requestId: 'second-edit',
      ops: [
        {
          kind: 'set',
          blockId,
          text: 'server version',
          decorator: '{"type":"p"}',
          expected: secondExpected,
        },
      ],
    }),
  );
  const secondSync = await secondEdit;
  check(secondSync.type === 'sync_ok', 'second client can edit through sync');

  const firstAgain = await connect(cookie);
  const changedInit = await join(firstAgain, documentId, {
    baseHash,
    localHash: baseHash,
  });
  const changedBlocks = parseBlocks(changedInit);
  check(changedInit.unchanged === false, 'stale hashes force a full snapshot');
  check(
    changedBlocks[0]?.text === 'server version',
    'reconnecting client receives the remote edit',
  );
  const changedHash = changedInit.contentHash;

  const expected = fingerprintBlock(changedBlocks[0]);
  const syncResultPromise = nextMessage(firstAgain);
  const secondUpdatePromise = nextMessage(second);
  firstAgain.send(
    JSON.stringify({
      type: 'sync',
      documentId,
      requestId: 'sync-1',
      ops: [
        {
          kind: 'set',
          blockId,
          text: 'merged local',
          decorator: '{"type":"p"}',
          expected,
        },
      ],
    }),
  );
  const syncResult = await syncResultPromise;
  check(
    syncResult.type === 'sync_ok' && syncResult.contentHash !== changedHash,
    'sync applies the merged operation and returns a new hash',
  );
  const secondUpdate = await secondUpdatePromise;
  check(
    secondUpdate.type === 'block_updated' && secondUpdate.text === 'merged local',
    'other clients receive the synced edit',
  );

  const conflictResultPromise = nextMessage(firstAgain);
  firstAgain.send(
    JSON.stringify({
      type: 'sync',
      documentId,
      requestId: 'sync-stale',
      ops: [
        {
          kind: 'set',
          blockId,
          text: 'stale overwrite',
          decorator: '{"type":"p"}',
          expected,
        },
      ],
    }),
  );
  const conflictResult = await conflictResultPromise;
  check(
    conflictResult.type === 'sync_conflict' && conflictResult.conflicts?.[0]?.blockId === blockId,
    'stale fingerprints return a sync conflict with the current block',
  );

  const unchangedHash = syncResult.contentHash;
  const titleBroadcast = nextMessage(second);
  firstAgain.send(JSON.stringify({ type: 'title_update', documentId, title: 'Remote title' }));
  const titleUpdate = await titleBroadcast;
  check(titleUpdate.type === 'title_updated', 'other clients receive the title update');
  firstAgain.close();

  const titleOnly = await connect(cookie);
  const titleOnlyInit = await join(titleOnly, documentId, {
    baseHash: unchangedHash,
    localHash: unchangedHash,
  });
  check(titleOnlyInit.unchanged === true, 'title-only change keeps the unchanged fast path');
  check(!titleOnlyInit.document?.content, 'unchanged init omits the document body');
  check(titleOnlyInit.title === 'Remote title', 'unchanged init still carries the new title');

  const unchanged = await join(titleOnly, documentId, {
    baseHash: titleOnlyInit.contentHash,
    localHash: titleOnlyInit.contentHash,
  });
  check(unchanged.unchanged === true, 'matching hashes skip the snapshot');

  titleOnly.close();
  second.close();
  await request('DELETE', `/api/documents/${documentId}`, { cookie });
  console.log('\nAll reconnect checks passed.');
  process.exit(0);
})().catch((error) => {
  console.error('\n' + error.message);
  process.exit(1);
});
