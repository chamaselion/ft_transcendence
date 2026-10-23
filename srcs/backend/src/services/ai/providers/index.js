/**
 * AI Provider Adapters for OpenAI, DeepSeek, Anthropic, and Mock testing.
 */

const parseSseData = (raw) =>
  raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

async function* readSseData(response) {
  if (!response.body) {
    throw new Error('AI provider response has no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const drain = () => {
    const events = [];
    let separator = buffer.match(/\r?\n\r?\n/);
    while (separator && separator.index !== undefined) {
      events.push(buffer.slice(0, separator.index));
      buffer = buffer.slice(separator.index + separator[0].length);
      separator = buffer.match(/\r?\n\r?\n/);
    }
    return events;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (const raw of drain()) {
      const data = parseSseData(raw);
      if (data) yield data;
    }
  }

  buffer += decoder.decode();
  for (const raw of drain()) {
    const data = parseSseData(raw);
    if (data) yield data;
  }

  const trailing = parseSseData(buffer);
  if (trailing) yield trailing;
}

class BaseAiProvider {
  constructor(config = {}) {
    this.config = config;
    this.model = config.model;
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl ? config.baseUrl.replace(/\/+$/, '') : '';
    this.timeoutMs = config.timeoutMs || 15000;
  }

  async complete({ systemPrompt, userPrompt }) {
    throw new Error('complete() must be implemented by subclass');
  }

  async *stream() {
    throw new Error('stream() must be implemented by subclass');
  }

  createSignal() {
    if (typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(this.timeoutMs);
    }
    const controller = new AbortController();
    setTimeout(() => controller.abort(), this.timeoutMs);
    return controller.signal;
  }
}

class OpenAiCompatibleProvider extends BaseAiProvider {
  constructor(config = {}, defaultBaseUrl = 'https://api.openai.com/v1', defaultModel = 'gpt-4o-mini') {
    super(config);
    this.endpoint = (this.baseUrl || defaultBaseUrl) + '/chat/completions';
    this.model = this.model || defaultModel;
  }

  async complete({ systemPrompt, userPrompt }) {
    if (!this.apiKey) {
      throw new Error(`API key is required for ${this.constructor.name}`);
    }

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.2,
      }),
      signal: this.createSignal(),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `AI request failed with HTTP ${response.status}: ${errorBody || response.statusText}`
      );
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Unexpected response shape from AI provider');
    }
    return content.trim();
  }

  async *stream({ systemPrompt, userPrompt, signal }) {
    if (!this.apiKey) {
      throw new Error(`API key is required for ${this.constructor.name}`);
    }

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.2,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `AI request failed with HTTP ${response.status}: ${errorBody || response.statusText}`
      );
    }

    for await (const data of readSseData(response)) {
      if (data === '[DONE]') return;

      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }

      const delta = event.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) {
        yield delta;
      }
    }
  }
}

class OpenAiProvider extends OpenAiCompatibleProvider {
  constructor(config = {}) {
    super(config, 'https://api.openai.com/v1', 'gpt-4o-mini');
  }
}

class DeepSeekProvider extends OpenAiCompatibleProvider {
  constructor(config = {}) {
    super(config, 'https://api.deepseek.com/v1', 'deepseek-flash');
  }
}

class AnthropicProvider extends BaseAiProvider {
  constructor(config = {}) {
    super(config);
    this.endpoint = (this.baseUrl || 'https://api.anthropic.com/v1') + '/messages';
    this.model = this.model || 'claude-3-5-haiku-20241022';
  }

  async complete({ systemPrompt, userPrompt }) {
    if (!this.apiKey) {
      throw new Error('API key is required for AnthropicProvider');
    }

    const body = {
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.2,
    };
    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: this.createSignal(),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Anthropic request failed with HTTP ${response.status}: ${errorBody || response.statusText}`
      );
    }

    const json = await response.json();
    const textBlock = json.content?.find((c) => c.type === 'text') || json.content?.[0];
    const content = textBlock?.text;
    if (typeof content !== 'string') {
      throw new Error('Unexpected response shape from Anthropic provider');
    }
    return content.trim();
  }

  async *stream({ systemPrompt, userPrompt, signal }) {
    if (!this.apiKey) {
      throw new Error('API key is required for AnthropicProvider');
    }

    const body = {
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.2,
      stream: true,
    };
    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Anthropic request failed with HTTP ${response.status}: ${errorBody || response.statusText}`
      );
    }

    for await (const data of readSseData(response)) {
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }

      if (event.type === 'message_stop') {
        return;
      }
      if (event.type === 'error') {
        throw new Error(event.error?.message || 'Anthropic stream failed');
      }
      if (
        event.type === 'content_block_delta' &&
        event.delta?.type === 'text_delta' &&
        typeof event.delta.text === 'string'
      ) {
        yield event.delta.text;
      }
    }
  }
}

// Mock provider for testing and development without real API calls.
// Will add a [DE] or [HU] tag to the text based on the system prompt, or strip it for back-translation to English.
class MockProvider extends BaseAiProvider {
  async complete({ systemPrompt, userPrompt }) {
    // Check if this is a structured JSON batch translation request
    if (userPrompt.includes('"blocks"') || userPrompt.includes('JSON')) {
      try {
        const jsonMatch = userPrompt.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          const blocks = Array.isArray(parsed) ? parsed : parsed.blocks || [];
          const isToGerman = /german|deutsch|"de"/i.test(systemPrompt + userPrompt);
          const isToHungarian = /hungarian|magyar|"hu"/i.test(systemPrompt + userPrompt);
          const langTag = isToHungarian ? 'HU' : isToGerman ? 'DE' : 'EN';

          const translatedBlocks = blocks.map((b) => {
            let t = b.text || '';
            // Strip any existing language tag if translating back to EN
            if (langTag === 'EN') {
              t = t.replace(/^\[(DE|HU)\]\s*/, '');
            } else if (!t.startsWith(`[${langTag}]`)) {
              t = `[${langTag}] ${t}`;
            }
            return { id: b.id, text: t };
          });

          return JSON.stringify({ blocks: translatedBlocks });
        }
      } catch {
        // Fall back to plain text mock
      }
    }

    // Check if this is an AI block elaboration request
    if (userPrompt.includes('Text to rewrite:\n') || systemPrompt.includes('rewriting a block')) {
      let targetText = userPrompt;
      const textMarker = 'Text to rewrite:\n';
      if (userPrompt.includes(textMarker)) {
        targetText = userPrompt.split(textMarker)[1].trim();
      }
      const cleanText = targetText.replace(/^\[(DE|HU)\]\s*/, '').trim();
      const personaMatch = systemPrompt.match(/You are (The [^.]+)\./);
      const personaName = personaMatch ? personaMatch[1] : 'Elaborated Persona';
      return `[${personaName}] ${cleanText}`;
    }

    // Single text back-translation / translation
    const isToEnglish = /english|"en"/i.test(systemPrompt + userPrompt);
    let targetText = userPrompt;
    const textMarker = 'Text to translate:\n';
    if (userPrompt.includes(textMarker)) {
      targetText = userPrompt.split(textMarker)[1].trim();
    }
    const cleanText = targetText.replace(/^\[(DE|HU)\]\s*/, '').trim();
    if (isToEnglish) {
      return cleanText;
    }
    const isHungarian = /hungarian|magyar|"hu"/i.test(systemPrompt + userPrompt);
    const tag = isHungarian ? 'HU' : 'DE';
    return `[${tag}] ${cleanText}`;
  }

  async *stream({ systemPrompt, userPrompt, signal }) {
    const result = await this.complete({ systemPrompt, userPrompt });
    const chunks = result.match(/\S+\s*/g) ?? [result];

    for (const chunk of chunks) {
      if (signal?.aborted) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
      yield chunk;
    }
  }
}

const resolveProvider = (config = {}) => {
  const provider = (config.provider || 'mock').toLowerCase();
  switch (provider) {
    case 'openai':
      return new OpenAiProvider(config);
    case 'deepseek':
      return new DeepSeekProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'mock':
    default:
      return new MockProvider(config);
  }
};

module.exports = {
  BaseAiProvider,
  OpenAiProvider,
  DeepSeekProvider,
  AnthropicProvider,
  MockProvider,
  resolveProvider,
};
