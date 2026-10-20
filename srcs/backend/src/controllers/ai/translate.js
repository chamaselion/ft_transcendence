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

      const service = getService();
      if (!service.isSupportedLanguage(sourceLang) || !service.isSupportedLanguage(targetLang)) {
        return res.status(400).json({
          error: `Unsupported language pair (${sourceLang} -> ${targetLang}). Supported: en, de, hu`,
        });
      }

      if (blocks !== undefined) {
        if (!Array.isArray(blocks)) {
          return res.status(400).json({ error: 'blocks must be an array of { id, text }' });
        }
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
