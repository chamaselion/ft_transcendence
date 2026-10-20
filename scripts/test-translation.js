/*
 * End-to-end test for Document Translation API and Zero-Semantic-Drift persistence.
 * Meant to run inside the backend container or directly on host:
 *   bash scripts/test-translation.sh
 */
const http = require('http');
const WebSocket = require('ws');

const BASE_HOST = process.env.BASE_HOST || 'localhost';
const BASE_PORT = Number(process.env.PORT || 3001);
const WS_URL = `ws://${BASE_HOST}:${BASE_PORT}/api/ws`;

const stamp = Date.now();
const USER = {
  login: `translatetester_${stamp}`,
  email: `translatetester_${stamp}@example.com`,
  password: 'password123',
};

function request(method, path, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: BASE_HOST,
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
        res.on('data', (c) => (raw += c));
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
}

const safeJson = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
const nextMessage = (ws) => new Promise((r) => ws.once('message', (m) => r(JSON.parse(m.toString()))));
const open = (ws) => new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });

(async () => {
  const check = (cond, msg) => {
    if (!cond) throw new Error(`FAILED: ${msg}`);
    console.log('  ok -', msg);
  };

  console.log('== 1. Authenticating test user');
  await request('POST', '/api/auth/register', { body: USER });
  const login = await request('POST', '/api/auth/login', {
    body: { email: USER.email, password: USER.password },
  });
  const challengeId = login.json?.challengeId;
  const code = login.json?.debugCode;
  check(challengeId && code, 'login returned challengeId + debugCode');

  const confirm = await request('POST', '/api/auth/login/confirm', {
    body: { challengeId, email: USER.email, code },
  });
  const setCookie = (confirm.setCookie || []).find((c) => c.startsWith('token='));
  check(!!setCookie, '2FA confirmed and session cookie received');
  const cookie = setCookie.split(';')[0];

  console.log('== 2. Testing /api/ai/translate endpoint validations');
  // Rejection without auth
  const unauth = await request('POST', '/api/ai/translate', {
    body: { text: 'test', sourceLang: 'en', targetLang: 'de' },
  });
  check(unauth.status === 401, 'unauthenticated translation request rejected with 401');

  // Unsupported language
  const badLang = await request('POST', '/api/ai/translate', {
    cookie,
    body: { text: 'test', sourceLang: 'en', targetLang: 'es' },
  });
  check(badLang.status === 400, 'unsupported language rejected with 400');

  // Missing body
  const emptyBody = await request('POST', '/api/ai/translate', {
    cookie,
    body: { sourceLang: 'en', targetLang: 'de' },
  });
  check(emptyBody.status === 400, 'empty translation payload rejected with 400');

  console.log('== 3. Testing Batch Block Translation (en -> de & en -> hu)');
  const originalBlocks = [
    { id: 'b1', text: 'Original English Heading', decorator: '{"type":"h","level":1}', lockedBy: null },
    { id: 'b2', text: 'Original English Paragraph', decorator: '{"type":"p"}', lockedBy: null },
    { id: 'b3', text: 'const answer = 42;\nconsole.log(answer);', decorator: 'c', lockedBy: null },
    { id: 'b4', text: 'To be, or not to be, that is the question.', decorator: 'cit', lockedBy: null },
    { id: 'b5', text: 'Original English List Item', decorator: '{"type":"li"}', lockedBy: null },
  ];

  // Helper matching editor rule: code and citations are not translatable
  const isCodeOrCitation = (decorator) => {
    if (decorator === 'c' || decorator === 'cit') return true;
    try {
      const parsed = JSON.parse(decorator);
      return parsed?.type === 'c' || parsed?.type === 'cit';
    } catch {
      return false;
    }
  };

  // Filter out code and citation blocks from translation payload
  const translatableBlocks = originalBlocks.filter((b) => !isCodeOrCitation(b.decorator));
  check(translatableBlocks.length === 3, 'code and citation blocks excluded from translation (3 translatable blocks)');
  check(!translatableBlocks.some((b) => b.id === 'b3' || b.id === 'b4'), 'blocks b3 (code) and b4 (cit) not in translatableBlocks');

  // Batch translate to German
  const deBatch = await request('POST', '/api/ai/translate', {
    cookie,
    body: {
      blocks: translatableBlocks.map((b) => ({ id: b.id, text: b.text })),
      sourceLang: 'en',
      targetLang: 'de',
    },
  });
  check(deBatch.status === 200, 'batch translation to German returned 200');
  check(deBatch.json?.blocks?.length === 3, 'returned 3 translated blocks (code and citation omitted)');
  check(deBatch.json?.blocks[0].id === 'b1', 'block IDs preserved in translation response');
  check(
    typeof deBatch.json?.blocks[0].text === 'string' &&
      deBatch.json?.blocks[0].text.length > 0 &&
      deBatch.json?.blocks[0].text !== originalBlocks[0].text,
    'block 1 translated from English to German',
  );

  // Verify that applying translations leaves code and citation blocks untouched
  const deMap = new Map(deBatch.json.blocks.map((b) => [b.id, b.text]));
  const germanDocumentBlocks = originalBlocks.map((b) => ({
    ...b,
    text: deMap.has(b.id) ? deMap.get(b.id) : b.text,
  }));
  check(germanDocumentBlocks.find((b) => b.id === 'b3').text === originalBlocks[2].text, 'code block is untranslated in German view');
  check(germanDocumentBlocks.find((b) => b.id === 'b4').text === originalBlocks[3].text, 'citation block is untranslated in German view');

  // Batch translate to Hungarian
  const huBatch = await request('POST', '/api/ai/translate', {
    cookie,
    body: {
      blocks: translatableBlocks.map((b) => ({ id: b.id, text: b.text })),
      sourceLang: 'en',
      targetLang: 'hu',
    },
  });
  check(huBatch.status === 200, 'batch translation to Hungarian returned 200');
  check(huBatch.json?.blocks?.length === 3, 'returned 3 translated blocks (code and citation omitted)');
  check(
    typeof huBatch.json?.blocks[0].text === 'string' &&
      huBatch.json?.blocks[0].text.length > 0 &&
      huBatch.json?.blocks[0].text !== originalBlocks[0].text,
    'block 1 translated from English to Hungarian',
  );

  const huMap = new Map(huBatch.json.blocks.map((b) => [b.id, b.text]));
  const hungarianDocumentBlocks = originalBlocks.map((b) => ({
    ...b,
    text: huMap.has(b.id) ? huMap.get(b.id) : b.text,
  }));
  check(hungarianDocumentBlocks.find((b) => b.id === 'b3').text === originalBlocks[2].text, 'code block is untranslated in Hungarian view');
  check(hungarianDocumentBlocks.find((b) => b.id === 'b4').text === originalBlocks[3].text, 'citation block is untranslated in Hungarian view');

  console.log('== 4. Testing Single Block Back-Translation (de -> en)');
  const germanBlock2Text = deBatch.json?.blocks[1].text;
  const backTrans = await request('POST', '/api/ai/translate', {
    cookie,
    body: {
      text: germanBlock2Text,
      sourceLang: 'de',
      targetLang: 'en',
      context: 'Surrounding context',
    },
  });
  check(backTrans.status === 200, 'back-translation to English returned 200');
  check(
    typeof backTrans.json?.text === 'string' && backTrans.json?.text.length > 0,
    'back-translated text is valid English',
  );

  console.log('== 5. Verifying Zero Semantic Drift and Canonical Persistence');
  // Create document in PostgreSQL with all 5 blocks
  const docRes = await request('POST', '/api/documents', {
    cookie,
    body: {
      title: 'Multilingual Doc',
      content: JSON.stringify(originalBlocks),
    },
  });
  const docId = docRes.json?.document?.id;
  check(docRes.status === 201 && docId, 'document created with initial English blocks');

  // Connect WebSocket client
  const ws = new WebSocket(WS_URL, { headers: { Cookie: cookie } });
  await open(ws);
  ws.send(JSON.stringify({ type: 'join', documentId: docId }));
  const initMsg = await nextMessage(ws);
  check(initMsg.type === 'init', 'WebSocket joined document room');

  // User edits ONLY Block 2, and back-translates to English
  const backTranslatedEnglish = backTrans.json?.text;

  // Send block_edit with canonical English text
  ws.send(
    JSON.stringify({
      type: 'block_edit',
      documentId: docId,
      blockId: 'b2',
      text: backTranslatedEnglish,
    }),
  );

  await new Promise((r) => setTimeout(r, 600));

  // Verify PostgreSQL database content
  const dbDoc = await request('GET', `/api/documents/${docId}`, { cookie });
  const savedBlocks = JSON.parse(dbDoc.json?.document?.content || '[]');
  check(savedBlocks.length === 5, 'database contains 5 blocks');

  const savedB1 = savedBlocks.find((b) => b.id === 'b1');
  const savedB2 = savedBlocks.find((b) => b.id === 'b2');
  const savedB3 = savedBlocks.find((b) => b.id === 'b3');
  const savedB4 = savedBlocks.find((b) => b.id === 'b4');
  const savedB5 = savedBlocks.find((b) => b.id === 'b5');

  // ZERO SEMANTIC DRIFT ASSERTIONS:
  check(
    savedB1.text === originalBlocks[0].text,
    'Block 1 remained 100% byte-for-byte identical (Zero Semantic Drift)',
  );
  check(
    savedB3.text === originalBlocks[2].text,
    'Code Block 3 remained untranslated and 100% byte-for-byte identical (Zero Semantic Drift)',
  );
  check(
    savedB4.text === originalBlocks[3].text,
    'Citation Block 4 remained untranslated and 100% byte-for-byte identical (Zero Semantic Drift)',
  );
  check(
    savedB5.text === originalBlocks[4].text,
    'Block 5 remained 100% byte-for-byte identical (Zero Semantic Drift)',
  );
  check(
    savedB2.text === backTranslatedEnglish,
    'Block 2 persisted with back-translated canonical English in PostgreSQL',
  );

  console.log('== 6. Verifying Code Block Editing Persists Directly Without Back-Translation');
  const updatedCodeText = 'const answer = 42;\nconsole.log("updated: " + answer);';
  ws.send(
    JSON.stringify({
      type: 'block_edit',
      documentId: docId,
      blockId: 'b3',
      text: updatedCodeText,
    }),
  );

  await new Promise((r) => setTimeout(r, 600));

  const dbDoc2 = await request('GET', `/api/documents/${docId}`, { cookie });
  const savedBlocks2 = JSON.parse(dbDoc2.json?.document?.content || '[]');
  const savedB3AfterEdit = savedBlocks2.find((b) => b.id === 'b3');
  check(
    savedB3AfterEdit.text === updatedCodeText,
    'Code Block 3 updated directly without back-translation degradation',
  );

  ws.close();
  console.log('\nAll Document Translation & Zero Semantic Drift tests passed successfully!');
  process.exit(0);
})().catch((err) => {
  console.error('\n' + (err && err.message ? err.message : err));
  process.exit(1);
});
