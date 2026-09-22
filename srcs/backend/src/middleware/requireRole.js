// Role guard. Must run *after* requireAuth - it relies on `req.user.role`
// already being attached, it does not authenticate on its own.
//
// Usage: router.use(requireRole('admin'))
//        router.use(requireRole('admin', 'moderator'))
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  return next();
};

module.exports = { requireRole };
