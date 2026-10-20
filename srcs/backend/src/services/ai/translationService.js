const { getAiConfig } = require('../../config');
const { resolveProvider } = require('./providers');
const { stripTags } = require('../../controllers/documents/sanitize');

const SUPPORTED_LANGUAGES = Object.freeze(['en', 'de', 'hu']);

const LANGUAGE_NAMES = Object.freeze({
  en: 'English',
  de: 'German',
  hu: 'Hungarian',
});

class TranslationService {
  constructor(customConfig = null, customProvider = null) {
    this.config = customConfig || getAiConfig();
    this.provider = customProvider || resolveProvider(this.config);
  }

  isSupportedLanguage(lang) {
    return typeof lang === 'string' && SUPPORTED_LANGUAGES.includes(lang.toLowerCase());
  }

  getLanguageName(lang) {
    return LANGUAGE_NAMES[lang.toLowerCase()] || lang;
  }

  /**
   * Translates an array of document blocks from sourceLang to targetLang.
   * Keeps block IDs matched and strips any unsafe HTML markup from the output.
   *
   * @param {Object} options
   * @param {Array<{ id: string, text: string }>} options.blocks
   * @param {string} options.sourceLang - e.g. 'en'
   * @param {string} options.targetLang - e.g. 'de' or 'hu'
   * @returns {Promise<Array<{ id: string, text: string }>>}
   */
  async translateBatch({ blocks = [], sourceLang = 'en', targetLang }) {
    if (!this.isSupportedLanguage(sourceLang) || !this.isSupportedLanguage(targetLang)) {
      throw new Error(`Unsupported language pair: ${sourceLang} -> ${targetLang}`);
    }

    if (!Array.isArray(blocks) || blocks.length === 0) {
      return [];
    }

    // Identity translation
    if (sourceLang.toLowerCase() === targetLang.toLowerCase()) {
      return blocks.map((b) => ({ id: b.id, text: stripTags(String(b.text ?? '')) }));
    }

    const sourceName = this.getLanguageName(sourceLang);
    const targetName = this.getLanguageName(targetLang);

    const inputBlocks = blocks.map((b) => ({
      id: String(b.id),
      text: String(b.text ?? ''),
    }));

    const systemPrompt = [
      `You are an expert translator for a collaborative document editor.`,
      `Translate the text of each block accurately from ${sourceName} to ${targetName}.`,
      `Preserve original meaning, natural style, and technical terminology.`,
      `Preserve formatting placeholders and empty blocks as empty.`,
      `You MUST reply ONLY with a valid JSON object matching this exact schema:`,
      `{"blocks": [{"id": "<block_id>", "text": "<translated_text>"}]}`,
      `Do not include conversational filler, explanations, or codeblock delimiters.`,
    ].join(' ');

    const userPrompt = JSON.stringify({ blocks: inputBlocks });

    const rawResponse = await this.provider.complete({ systemPrompt, userPrompt });

    // Extract JSON payload even if model wrapped it in markdown code fences
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    let parsedBlocks = null;
    try {
      const parsed = JSON.parse(cleaned);
      parsedBlocks = Array.isArray(parsed) ? parsed : parsed.blocks;
    } catch {
      // Fallback: search for first JSON object/array
      const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          parsedBlocks = Array.isArray(parsed) ? parsed : parsed.blocks;
        } catch {
          parsedBlocks = null;
        }
      }
    }

    if (!Array.isArray(parsedBlocks)) {
      throw new Error('AI provider returned invalid JSON structure for batch translation');
    }

    const resultMap = new Map();
    for (const item of parsedBlocks) {
      if (item && item.id) {
        resultMap.set(String(item.id), stripTags(String(item.text ?? '')));
      }
    }

    // Return in original order, falling back to original text if missing
    return inputBlocks.map((b) => ({
      id: b.id,
      text: resultMap.has(b.id) ? resultMap.get(b.id) : stripTags(b.text),
    }));
  }

  /**
   * Translates a single text snippet (typically back-translating an edited block to English).
   *
   * @param {Object} options
   * @param {string} options.text
   * @param {string} options.sourceLang - e.g. 'de' or 'hu'
   * @param {string} options.targetLang - e.g. 'en'
   * @param {string} [options.context] - surrounding text to maintain correct tone/pronouns
   * @returns {Promise<string>}
   */
  async translateSingle({ text = '', sourceLang, targetLang = 'en', context = '' }) {
    if (!this.isSupportedLanguage(sourceLang) || !this.isSupportedLanguage(targetLang)) {
      throw new Error(`Unsupported language pair: ${sourceLang} -> ${targetLang}`);
    }

    const rawText = String(text ?? '');
    if (!rawText.trim()) {
      return '';
    }

    // Identity translation
    if (sourceLang.toLowerCase() === targetLang.toLowerCase()) {
      return stripTags(rawText);
    }

    const sourceName = this.getLanguageName(sourceLang);
    const targetName = this.getLanguageName(targetLang);

    const systemPrompt = [
      `You are an expert translator for a collaborative document editor.`,
      `Translate the provided text accurately from ${sourceName} into ${targetName}.`,
      `Preserve the tone, semantic nuances, and formatting intent.`,
      `Output ONLY the direct translated text with no quotes, explanations, or conversational filler.`,
    ].join(' ');

    let userPrompt = '';
    if (context && String(context).trim()) {
      userPrompt = `Surrounding document context for reference:\n${context.trim()}\n\nText to translate:\n${rawText}`;
    } else {
      userPrompt = rawText;
    }

    const rawResponse = await this.provider.complete({ systemPrompt, userPrompt });
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    // Remove wrapping quotes if model accidentally added them
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    return stripTags(cleaned);
  }
}

const createTranslationService = (config, provider) =>
  new TranslationService(config, provider);

module.exports = {
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  TranslationService,
  createTranslationService,
};
