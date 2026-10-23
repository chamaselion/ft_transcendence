const { createTranslationService } = require('../../services/ai/translationService');

/**
 * Controller for AI translation requests.
 * Handles both batch block translation (en -> de/hu) and single-block back-translation (de/hu -> en).
 */
const createTranslateHandler = ({ translationService } = {}) => {
  const getService = () => translationService || createTranslationService();

  const translate = async (req, res) => {
    try {
      const { blocks, text, sourceLang, targetLang, context } = req.body || {};

      if (!sourceLang || typeof sourceLang !== 'string') {
        return res.status(400).json({ error: 'sourceLang is required (en, de, hu)' });
      }
      if (!targetLang || typeof targetLang !== 'string') {
        return res.status(400).json({ error: 'targetLang is required (en, de, hu)' });
      }
      if (text !== undefined && typeof text !== 'string') {
        return res.status(400).json({ error: 'text must be a string' });
      }
      if (context !== undefined && typeof context !== 'string') {
        return res.status(400).json({ error: 'context must be a string' });
      }
      if (blocks !== undefined && !Array.isArray(blocks)) {
        return res.status(400).json({ error: 'blocks must be an array of { id, text }' });
      }
      if (
        Array.isArray(blocks) &&
        blocks.some(
          (block) =>
            !block ||
            typeof block !== 'object' ||
            Array.isArray(block) ||
            (block.text !== undefined && typeof block.text !== 'string'),
        )
      ) {
        return res.status(400).json({ error: 'blocks must be an array of { id, text }' });
      }
      if (
        (typeof text === 'string' && text.length > 5000) ||
        (Array.isArray(blocks) &&
          blocks.some((block) => typeof block.text === 'string' && block.text.length > 5000)) ||
        (typeof context === 'string' && context.length > 10000)
      ) {
        return res.status(400).json({ error: 'Request exceeds size limits' });
      }

      const service = getService();
      if (!service.isSupportedLanguage(sourceLang) || !service.isSupportedLanguage(targetLang)) {
        return res.status(400).json({
          error: `Unsupported language pair (${sourceLang} -> ${targetLang}). Supported: en, de, hu`,
        });
      }

      if (blocks !== undefined) {
        const translatedBlocks = await service.translateBatch({
          blocks,
          sourceLang,
          targetLang,
        });
        return res.json({
          blocks: translatedBlocks,
          sourceLang,
          targetLang,
        });
      }

      if (text !== undefined) {
        if (typeof text !== 'string') {
          return res.status(400).json({ error: 'text must be a string' });
        }
        const translatedText = await service.translateSingle({
          text,
          sourceLang,
          targetLang,
          context,
        });
        return res.json({
          text: translatedText,
          sourceLang,
          targetLang,
        });
      }

      return res.status(400).json({
        error: 'Either blocks array or text string must be provided for translation',
      });
    } catch (err) {
      console.error('[AI] translate failed:', err);
      return res.status(500).json({ error: err.message || 'Translation failed' });
    }
  };

  return { translate };
};

module.exports = { createTranslateHandler };
