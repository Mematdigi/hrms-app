/*
 * Memat Digi Inc.
 * www.mematdigi.com
 *
 * Generic caching middleware.
 *
 * 🐛 BUG FIX: the previous version did `require("../redis")` but src/redis.js
 * does not exist in this codebase — requiring this middleware anywhere would
 * crash the server at boot with "Cannot find module '../redis'".
 * (It was never imported by any route before, which is why it went unnoticed.)
 *
 * Rewritten as a self-contained in-memory TTL cache with the SAME call
 * signature, so no Redis server is needed. If Redis is added later, this can
 * be swapped back without touching the routes.
 *
 * Usage:  router.get('/tree', authMiddleware, cacheMiddleware(300), handler)
 *   or:   cacheMiddleware('prefix', 300)
 */

const store = new Map(); // key → { data, expiresAt }

// Periodic sweep so the map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}, 60 * 1000).unref();

function cacheMiddleware(keyPrefixOrTtl, maybeTtl) {
  // Support both cacheMiddleware(ttl) and cacheMiddleware(prefix, ttl)
  const keyPrefix = typeof keyPrefixOrTtl === 'string' ? keyPrefixOrTtl : 'cache';
  const ttl = typeof keyPrefixOrTtl === 'number' ? keyPrefixOrTtl : (maybeTtl || 60);

  return (req, res, next) => {
    try {
      const key = `${keyPrefix}:${req.originalUrl}`;
      const entry = store.get(key);

      if (entry && entry.expiresAt > Date.now()) {
        return res.json(entry.data);
      }

      // Monkey-patch res.json so we can save the data before sending
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        try {
          store.set(key, { data, expiresAt: Date.now() + ttl * 1000 });
        } catch (e) { /* never block the response on cache failure */ }
        return originalJson(data);
      };

      next();
    } catch (err) {
      console.error('❌ Cache error:', err);
      next();
    }
  };
}

// Allow controllers to invalidate cached entries after writes
cacheMiddleware.invalidate = (prefix) => {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
};

module.exports = cacheMiddleware;
