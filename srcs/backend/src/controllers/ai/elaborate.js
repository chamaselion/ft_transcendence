const { createElaborationService } = require('../../services/ai/elaborationService');

/**
 * Controller for AI block elaboration requests.
 * Rewrites paragraph blocks according to chosen AI personas.
 */
const createElaborateHandler = ({ elaborationService } = {}) => {
  const getService = () => elaborationService || createElaborationService();

  const sendEvent = (res, event, payload) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const elaborateStream = async (req, res) => {
    const { text, persona, context } = req.body || {};

    if (!persona || typeof persona !== 'string') {
      return res.status(400).json({ error: 'persona is required' });
    }

    if (text === undefined || typeof text !== 'string') {
      return res.status(400).json({ error: 'text must be a string' });
    }

    if (context !== undefined && context !== null && typeof context !== 'string') {
      return res.status(400).json({ error: 'context must be a string' });
    }

    const service = getService();
    if (!service.isSupportedPersona(persona)) {
      return res.status(400).json({
        error: `Unsupported persona: ${persona}`,
      });
    }

    if ((context?.length ?? 0) > 10000 || text.length > 5000) {
      return res.status(400).json({ error: 'Request exceeds size limits' });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let closed = false;
    const abortController = new AbortController();
    const timeoutMs = service.config?.timeoutMs || 15000;
    let idleTimer = null;

    const resetIdleTimer = () => {
      if (closed) return;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        abortController.abort(new Error('AI stream timed out'));
      }, timeoutMs);
    };

    const cleanup = () => {
      closed = true;
      clearTimeout(idleTimer);
      abortController.abort();
    };

    res.on('close', cleanup);

    try {
      resetIdleTimer();

      const elaboratedText = await service.elaborateStream({
        text,
        persona,
        context,
        signal: abortController.signal,
        onDelta: (chunk) => {
          if (closed || !chunk) return;
          resetIdleTimer();
          sendEvent(res, 'delta', { text: chunk });
        },
      });

      if (closed) return;

      sendEvent(res, 'done', {
        text: elaboratedText,
        persona,
      });
      res.end();
    } catch (err) {
      if (closed) return;

      console.error('[AI] elaborate stream failed:', err);
      sendEvent(res, 'error', { error: err.message || 'Elaboration failed' });
      res.end();
    } finally {
      clearTimeout(idleTimer);
    }
  };

  const getPersonas = async (req, res) => {
    try {
      const service = getService();
      const personas = service.getPersonas().map(({ key, name, category, description }) => ({
        key,
        name,
        category,
        description,
      }));
      return res.json({ personas });
    } catch (err) {
      console.error('[AI] getPersonas failed:', err);
      return res.status(500).json({ error: err.message || 'Failed to fetch personas' });
    }
  };

  return { elaborateStream, getPersonas };
};

module.exports = { createElaborateHandler };
