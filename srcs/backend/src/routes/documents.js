const express = require('express');
const { createDocumentsController } = require('../controllers/documents/documentsController');
const { createSharesController } = require('../controllers/documents/sharesController');
const { createRequireAuth } = require('../middleware/requireAuth');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimit');

const { requireAuth } = createRequireAuth();
const { create, list, get, update, remove } = createDocumentsController();
const shares = createSharesController();

const router = express.Router();

// Every document route requires an authenticated user.
router.use(requireAuth);

router.post('/', create);
router.get('/', list);
router.get('/:id', get);
router.patch('/:id', update);
router.delete('/:id', remove);

// Sharing resolves an email address to an account, so the response reveals
// whether an address is registered. Throttled per user (falling back to the
// client IP) so it can't be used to walk through a list of addresses.
const shareLimiter = createRateLimiter({
  name: 'document-shares',
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
});

router.get('/:id/shares', shareLimiter, shares.list);
router.post('/:id/shares', shareLimiter, shares.create);
router.patch('/:id/shares/:userId', shareLimiter, shares.update);
router.delete('/:id/shares/:userId', shareLimiter, shares.remove);

module.exports = router;
