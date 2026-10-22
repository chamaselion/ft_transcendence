const express = require('express');
const { createTranslateHandler } = require('../controllers/ai/translate');
const { createElaborateHandler } = require('../controllers/ai/elaborate');
const { createRequireAuth } = require('../middleware/requireAuth');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimit');

const { requireAuth } = createRequireAuth();
const { translate } = createTranslateHandler();
const { elaborateStream, getPersonas } = createElaborateHandler();

const router = express.Router();

router.use(requireAuth);

const aiLimiter = createRateLimiter({
  name: 'ai-translation',
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
});

const elaborateLimiter = createRateLimiter({
  name: 'ai-elaboration',
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
});

router.post('/translate', aiLimiter, translate);
router.post('/elaborate/stream', elaborateLimiter, elaborateStream);
router.get('/personas', getPersonas);

module.exports = router;
