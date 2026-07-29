/**
 * Cache Service — Redis Cache-Aside Pattern
 * 
 * Provides caching for feed, posts, profiles, and trending content.
 * Uses cache-aside pattern with TTL and automatic invalidation.
 *
 * @version 2.0.0
 */

const { getClient } = require('../config/redis');

// TTL Configuration (seconds)
const TTL = {
  FEED: 60,            // 1 minute — feeds change frequently
  POST: 300,           // 5 minutes — individual posts
  USER_PROFILE: 600,   // 10 minutes — profiles are stable
  COMMENTS: 30,        // 30 seconds — comments update often
  TRENDING: 120,       // 2 minutes — trending content
  POST_COUNTS: 60,     // 1 minute — like/comment counts
};

// Key prefix constants
const KEYS = {
  FEED: 'cache:feed',
  POST: 'cache:post',
  USER: 'cache:user',
  COMMENTS: 'cache:comments',
  TRENDING: 'cache:trending',
  COUNTS: 'cache:counts',
};

// Metrics counters
let metrics = { hits: 0, misses: 0, errors: 0, invalidations: 0 };

/**
 * Get value from cache, or execute fetchFn and cache the result
 * @param {string} key - Cache key
 * @param {number} ttl - Time-to-live in seconds
 * @param {Function} fetchFn - Async function to fetch data on cache miss
 * @returns {Promise<any>} Cached or fresh data
 */
async function getOrSet(key, ttl, fetchFn) {
  try {
    const redis = getClient();
    const cached = await redis.get(key);

    if (cached) {
      metrics.hits++;
      return JSON.parse(cached);
    }

    metrics.misses++;
    const fresh = await fetchFn();

    // Don't cache null/undefined results
    if (fresh != null) {
      await redis.setex(key, ttl, JSON.stringify(fresh));
    }

    return fresh;
  } catch (error) {
    metrics.errors++;
    console.error(`⚠️ Cache error for key ${key}:`, error.message);
    // Graceful fallback — execute fetchFn directly
    return fetchFn();
  }
}

/**
 * Get value from cache only (no fetch)
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function get(key) {
  try {
    const cached = await getClient().get(key);
    if (cached) { metrics.hits++; return JSON.parse(cached); }
    metrics.misses++;
    return null;
  } catch (error) {
    metrics.errors++;
    return null;
  }
}

/**
 * Set value in cache
 * @param {string} key
 * @param {any} value
 * @param {number} ttl - TTL in seconds
 */
async function set(key, value, ttl) {
  try {
    await getClient().setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    metrics.errors++;
    console.error(`⚠️ Cache set error for key ${key}:`, error.message);
  }
}

/**
 * Invalidate a specific key
 * @param {string} key
 */
async function invalidate(key) {
  try {
    await getClient().del(key);
    metrics.invalidations++;
  } catch (error) {
    metrics.errors++;
  }
}

/**
 * Invalidate all keys matching a pattern
 * @param {string} pattern - Redis glob pattern (e.g., 'cache:feed:*')
 */
async function invalidatePattern(pattern) {
  try {
    const redis = getClient();
    let cursor = '0';
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        metrics.invalidations += keys.length;
      }
    } while (cursor !== '0');
  } catch (error) {
    metrics.errors++;
    console.error(`⚠️ Cache invalidation error for pattern ${pattern}:`, error.message);
  }
}

// ============================
// Domain-Specific Cache Helpers
// ============================

/** Cache key builders */
const keyFor = {
  feed: (userId, page) => `${KEYS.FEED}:${userId}:${page}`,
  allPosts: (page) => `${KEYS.FEED}:all:${page}`,
  post: (postId) => `${KEYS.POST}:${postId}`,
  userProfile: (username) => `${KEYS.USER}:${username}`,
  comments: (postId, page) => `${KEYS.COMMENTS}:${postId}:${page}`,
  trending: () => `${KEYS.TRENDING}:top`,
  postCounts: (postId) => `${KEYS.COUNTS}:${postId}`,
};

/** Invalidate all caches related to a post */
async function invalidatePost(postId) {
  await Promise.all([
    invalidate(keyFor.post(postId)),
    invalidatePattern(`${KEYS.COMMENTS}:${postId}:*`),
    invalidate(keyFor.postCounts(postId)),
    invalidatePattern(`${KEYS.FEED}:*`),
  ]);
}

/** Invalidate all caches related to a user */
async function invalidateUser(username) {
  await Promise.all([
    invalidate(keyFor.userProfile(username)),
    invalidatePattern(`${KEYS.FEED}:*`),
  ]);
}

/** Get current metrics and reset */
function getMetrics() {
  const snapshot = { ...metrics };
  const total = snapshot.hits + snapshot.misses;
  snapshot.hit_rate = total > 0 ? (snapshot.hits / total * 100).toFixed(2) + '%' : '0%';
  return snapshot;
}

function resetMetrics() {
  metrics = { hits: 0, misses: 0, errors: 0, invalidations: 0 };
}

module.exports = {
  getOrSet,
  get,
  set,
  invalidate,
  invalidatePattern,
  invalidatePost,
  invalidateUser,
  keyFor,
  getMetrics,
  resetMetrics,
  TTL,
};
