const express = require('express');
const { createTranslateHandler } = require('../controllers/ai/translate');
const { createRequireAuth } = require('../middleware/requireAuth');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimit');

const { requireAuth } = createRequireAuth();
const { translate } = createTranslateHandler();

const router = express.Router();

router.use(requireAuth);

const aiLimiter = createRateLimiter({
  name: 'ai-translation',
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
});

router.post('/translate', aiLimiter, translate);

module.exports = router;
