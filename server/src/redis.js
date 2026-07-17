/*
 * Redis wrapper with graceful in-memory fallback.
 *
 * BUGFIX: middleware/cacheMiddleware.js does `require('../redis')` but this file
 * never existed — importing cacheMiddleware anywhere would crash the server.
 *
 * Behaviour:
 *   - If REDIS_URL is set AND `ioredis` is installed → use real Redis.
 *   - Otherwise → fall back to a tiny in-memory TTL cache with the same
 *     get/set(key, value, 'EX', ttl) surface, so cacheMiddleware works
 *     out of the box on a single PM2 instance without extra infra.
 */
let client = null;

try {
  if (process.env.REDIS_URL) {
    const Redis = require('ioredis');
    client = new Redis(process.env.REDIS_URL);
    client.on('error', (err) => console.error('Redis error:', err.message));
    console.log('🧠 Cache: using Redis at', process.env.REDIS_URL);
  }
} catch (e) {
  console.warn('⚠️ ioredis not installed — falling back to in-memory cache');
}

if (!client) {
  const store = new Map(); // key → { value, expiresAt }

  client = {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    // Mirrors ioredis signature: set(key, value, 'EX', seconds)
    async set(key, value, exFlag, ttlSeconds) {
      const expiresAt =
        exFlag === 'EX' && ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
      store.set(key, { value, expiresAt });
      return 'OK';
    },
    async del(...keys) {
      let n = 0;
      keys.flat().forEach((k) => { if (store.delete(k)) n++; });
      return n;
    },
    // Simple prefix invalidation used after hierarchy edits
    async delByPrefix(prefix) {
      let n = 0;
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) { store.delete(k); n++; }
      }
      return n;
    },
  };
  console.log('🧠 Cache: using in-memory fallback (set REDIS_URL to use Redis)');
}

module.exports = client;
