const { createElaborationService } = require('../../services/ai/elaborationService');

/**
 * Controller for AI block elaboration requests.
 * Rewrites paragraph blocks according to chosen AI personas.
 */
const createElaborateHandler = ({ elaborationService } = {}) => {
  const getService = () => elaborationService || createElaborationService();

  const elaborate = async (req, res) => {
    try {
      const { text, persona, context } = req.body || {};

      if (!persona || typeof persona !== 'string') {
        return res.status(400).json({ error: 'persona is required' });
      }

      if (text === undefined || typeof text !== 'string') {
        return res.status(400).json({ error: 'text must be a string' });
      }

      const service = getService();
      if (!service.isSupportedPersona(persona)) {
        return res.status(400).json({
          error: `Unsupported persona: ${persona}`,
        });
      }

      const elaboratedText = await service.elaborate({
        text,
        persona,
        context,
      });

      return res.json({
        text: elaboratedText,
        persona,
      });
    } catch (err) {
      console.error('[AI] elaborate failed:', err);
      return res.status(500).json({ error: err.message || 'Elaboration failed' });
    }
  };

  const getPersonas = async (req, res) => {
    try {
      const service = getService();
      return res.json({
        personas: service.getPersonas(),
      });
    } catch (err) {
      console.error('[AI] getPersonas failed:', err);
      return res.status(500).json({ error: err.message || 'Failed to fetch personas' });
    }
  };

  return { elaborate, getPersonas };
};

module.exports = { createElaborateHandler };
