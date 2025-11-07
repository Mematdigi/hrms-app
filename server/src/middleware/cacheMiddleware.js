const redis = require("../redis");

// Generic caching middleware
function cacheMiddleware(keyPrefix, ttl = 60) {
  return async (req, res, next) => {
    try {
      // Use URL as part of the cache key to avoid conflicts
      const key = `${keyPrefix}:${req.originalUrl}`;

      const cachedData = await redis.get(key);
      if (cachedData) {
        console.log(`📦 Serving from Redis cache: ${key}`);
        return res.json(JSON.parse(cachedData));
      }

      // Monkey-patch res.json so we can save the data to Redis before sending
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        redis.set(key, JSON.stringify(data), "EX", ttl);
        return originalJson(data);
      };

      next(); // go to actual route handler
    } catch (err) {
      console.error("❌ Cache error:", err);
      next(); // fall back to route handler if Redis fails
    }
  };
}

module.exports = cacheMiddleware;
