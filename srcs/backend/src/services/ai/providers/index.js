/**
 * AI Provider Adapters for OpenAI, DeepSeek, Anthropic, and Mock testing.
 */

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
