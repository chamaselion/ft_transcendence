const express = require('express');
const { createUsersController } = require('../controllers/admin/usersController');
const { createRequireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimit');

const { requireAuth } = createRequireAuth();
const { list, get, update, remove } = createUsersController();

const router = express.Router();

// These endpoints can enumerate and modify every account, so they get the same
// kind of throttling the auth routes have instead of being the one unlimited
// corner of the API. Keyed per admin, falling back to the client IP.
const adminUsersLimiter = createRateLimiter({
  name: 'admin-users',
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
});

// Must be logged in AND have the 'admin' role for every route below.
// Order matters: requireAuth attaches req.user, requireRole reads it, and the
// limiter keys on req.user so it has to run after both.
router.use(requireAuth);
router.use(requireRole('admin'));
router.use(adminUsersLimiter);

router.get('/', list);
router.get('/:id', get);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;
