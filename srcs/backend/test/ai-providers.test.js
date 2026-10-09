const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OpenAiProvider,
  DeepSeekProvider,
  AnthropicProvider,
  MockProvider,
  resolveProvider,
} = require('../src/services/ai/providers');
const {
  TranslationService,
  createTranslationService,
} = require('../src/services/ai/translationService');
const { createTranslateHandler } = require('../src/controllers/ai/translate');

test('MockProvider translates batch and single texts deterministically', async () => {
  const provider = new MockProvider();
  const service = new TranslationService({ provider: 'mock' }, provider);

  const blocks = [
    { id: 'b1', text: 'Hello world' },
    { id: 'b2', text: 'Welcome to Transcendence' },
  ];

  // en -> de
  const germanBlocks = await service.translateBatch({ blocks, sourceLang: 'en', targetLang: 'de' });
  assert.equal(germanBlocks.length, 2);
  assert.equal(germanBlocks[0].id, 'b1');
  assert.equal(germanBlocks[0].text, '[DE] Hello world');
  assert.equal(germanBlocks[1].id, 'b2');
  assert.equal(germanBlocks[1].text, '[DE] Welcome to Transcendence');

  // de -> en (back-translation)
  const englishText = await service.translateSingle({
    text: germanBlocks[0].text,
    sourceLang: 'de',
    targetLang: 'en',
  });
  assert.equal(englishText, 'Hello world');

  // en -> hu
  const hungarianBlocks = await service.translateBatch({ blocks, sourceLang: 'en', targetLang: 'hu' });
  assert.equal(hungarianBlocks[0].text, '[HU] Hello world');
  assert.equal(hungarianBlocks[1].text, '[HU] Welcome to Transcendence');
});

test('TranslationService strips malicious HTML tags from output', async () => {
  class XssProvider {
    async complete() {
      return JSON.stringify({
        blocks: [{ id: 'x1', text: '<script>alert(1)</script><b>Safe</b> and <img src=x onerror=alert(2)>' }],
      });
    }
  }

  const service = new TranslationService({ provider: 'mock' }, new XssProvider());
  const res = await service.translateBatch({
    blocks: [{ id: 'x1', text: 'raw' }],
    sourceLang: 'en',
    targetLang: 'de',
  });

  assert.equal(res[0].text, 'Safe and ');
  assert.ok(!res[0].text.includes('<script>'));
  assert.ok(!res[0].text.includes('<img'));
});

test('TranslationService rejects unsupported languages', async () => {
  const service = new TranslationService();
  await assert.rejects(
    () => service.translateBatch({ blocks: [], sourceLang: 'en', targetLang: 'es' }),
    /Unsupported language pair/,
  );
  await assert.rejects(
    () => service.translateSingle({ text: 'test', sourceLang: 'fr', targetLang: 'en' }),
    /Unsupported language pair/,
  );
});

test('TranslationService returns immediately if sourceLang === targetLang', async () => {
  let providerCalled = false;
  class SpyProvider {
    async complete() {
      providerCalled = true;
      return '';
    }
  }

  const service = new TranslationService({ provider: 'mock' }, new SpyProvider());
  const res = await service.translateBatch({
    blocks: [{ id: 'b1', text: 'Same' }],
    sourceLang: 'en',
    targetLang: 'en',
  });
  assert.equal(providerCalled, false);
  assert.equal(res[0].text, 'Same');
});

test('OpenAiProvider builds correct OpenAI Chat Completions payload with configurable model', async () => {
  const originalFetch = global.fetch;
  let capturedRequest = null;

  global.fetch = async (url, opts) => {
    capturedRequest = { url, ...opts, body: JSON.parse(opts.body) };
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Translated content' } }],
      }),
    };
  };

  try {
    const provider = new OpenAiProvider({
      apiKey: 'test-key-123',
      model: 'gpt-4o',
      baseUrl: 'https://custom-openai-proxy.internal/v1',
    });

    const result = await provider.complete({
      systemPrompt: 'System instructions',
      userPrompt: 'User message',
    });

    assert.equal(result, 'Translated content');
    assert.equal(capturedRequest.url, 'https://custom-openai-proxy.internal/v1/chat/completions');
    assert.equal(capturedRequest.headers.Authorization, 'Bearer test-key-123');
    assert.equal(capturedRequest.body.model, 'gpt-4o');
    assert.equal(capturedRequest.body.messages.length, 2);
    assert.equal(capturedRequest.body.messages[0].role, 'system');
    assert.equal(capturedRequest.body.messages[1].role, 'user');
  } finally {
    global.fetch = originalFetch;
  }
});

test('DeepSeekProvider defaults to deepseek-chat and targets DeepSeek endpoint', async () => {
  const originalFetch = global.fetch;
  let capturedRequest = null;

  global.fetch = async (url, opts) => {
    capturedRequest = { url, ...opts, body: JSON.parse(opts.body) };
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'DeepSeek response' } }],
      }),
    };
  };

  try {
    const provider = new DeepSeekProvider({
      apiKey: 'ds-key-456',
    });

    const result = await provider.complete({
      systemPrompt: 'Translate',
      userPrompt: 'Text',
    });

    assert.equal(result, 'DeepSeek response');
    assert.equal(capturedRequest.url, 'https://api.deepseek.com/v1/chat/completions');
    assert.equal(capturedRequest.headers.Authorization, 'Bearer ds-key-456');
    assert.equal(capturedRequest.body.model, 'deepseek-chat');
  } finally {
    global.fetch = originalFetch;
  }
});

test('AnthropicProvider formats Messages API with separate system prompt and x-api-key', async () => {
  const originalFetch = global.fetch;
  let capturedRequest = null;

  global.fetch = async (url, opts) => {
    capturedRequest = { url, ...opts, body: JSON.parse(opts.body) };
    return {
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Anthropic response' }],
      }),
    };
  };

  try {
    const provider = new AnthropicProvider({
      apiKey: 'anthropic-key-789',
      model: 'claude-3-5-sonnet-20241022',
    });

    const result = await provider.complete({
      systemPrompt: 'System instructions',
      userPrompt: 'User text',
    });

    assert.equal(result, 'Anthropic response');
    assert.equal(capturedRequest.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(capturedRequest.headers['x-api-key'], 'anthropic-key-789');
    assert.equal(capturedRequest.headers['anthropic-version'], '2023-06-01');
    assert.equal(capturedRequest.body.model, 'claude-3-5-sonnet-20241022');
    assert.equal(capturedRequest.body.system, 'System instructions');
    assert.equal(capturedRequest.body.messages[0].role, 'user');
    assert.equal(capturedRequest.body.messages[0].content, 'User text');
  } finally {
    global.fetch = originalFetch;
  }
});

test('createTranslateHandler handles batch and single requests with validation', async () => {
  const service = createTranslationService({ provider: 'mock' }, new MockProvider());
  const { translate } = createTranslateHandler({ translationService: service });

  // Missing source/target
  let status = 0;
  let jsonResponse = null;
  const mockRes = () => ({
    status: (s) => {
      status = s;
      return { json: (j) => { jsonResponse = j; } };
    },
    json: (j) => { status = 200; jsonResponse = j; },
  });

  await translate({ body: { blocks: [] } }, mockRes());
  assert.equal(status, 400);

  // Valid batch translation
  await translate({
    body: {
      blocks: [{ id: 'b1', text: 'Hello' }],
      sourceLang: 'en',
      targetLang: 'de',
    },
  }, mockRes());
  assert.equal(status, 200);
  assert.equal(jsonResponse.blocks[0].text, '[DE] Hello');

  // Valid single text back-translation
  await translate({
    body: {
      text: '[DE] Hello',
      sourceLang: 'de',
      targetLang: 'en',
    },
  }, mockRes());
  assert.equal(status, 200);
  assert.equal(jsonResponse.text, 'Hello');
});
