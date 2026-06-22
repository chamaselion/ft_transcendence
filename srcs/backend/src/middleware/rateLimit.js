const getClientIp = (req) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwardedFor) {
    return forwardedFor;
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const normalizeIdentity = (value) => String(value || '').trim().toLowerCase();

const createRateLimiter = ({
  name = 'rate-limit',
  windowMs = 60 * 1000,
  maxRequests = 60,
  keyGenerator,
} = {}) => {
  const entries = new Map();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of entries.entries()) {
      if (entry.resetAt <= now) {
        entries.delete(key);
      }
    }
  };

  setInterval(cleanup, Math.min(windowMs, 60_000)).unref?.();

  return (req, res, next) => {
    const now = Date.now();
    const key = String(keyGenerator ? keyGenerator(req) : getClientIp(req));

    let entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    entry.count += 1;
    entries.set(key, entry);

    const remaining = Math.max(0, maxRequests - entry.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many requests',
        limiter: name,
        retryAfterSeconds,
      });
    }

    return next();
  };
};

module.exports = {
  createRateLimiter,
  getClientIp,
  normalizeIdentity,
};
