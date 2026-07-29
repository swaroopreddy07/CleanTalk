/**
 * Redis Configuration
 * 
 * Centralized Redis client for cache, queues, and pub/sub.
 * Used by: cacheService, moderationQueue, Socket.IO adapter.
 *
 * @version 2.0.0
 */

const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const redisConfig = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    console.log(`🔄 Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    return targetErrors.some(e => err.message.includes(e));
  },
};

// Primary client (cache + general use)
let client = null;

// Subscriber client (for pub/sub — Redis requires separate connection)
let subscriber = null;

// Publisher client (for pub/sub)
let publisher = null;

/**
 * Get or create the primary Redis client
 * @returns {Redis} Redis client instance
 */
function getClient() {
  if (!client) {
    client = new Redis(redisConfig);
    client.on('connect', () => console.log('✅ Redis primary client connected'));
    client.on('error', (err) => console.error('❌ Redis primary error:', err.message));
    client.on('close', () => console.warn('⚠️ Redis primary connection closed'));
  }
  return client;
}

/**
 * Get or create a subscriber client (for Socket.IO adapter + pub/sub)
 * @returns {Redis} Redis subscriber client
 */
function getSubscriber() {
  if (!subscriber) {
    subscriber = new Redis(redisConfig);
    subscriber.on('connect', () => console.log('✅ Redis subscriber connected'));
    subscriber.on('error', (err) => console.error('❌ Redis subscriber error:', err.message));
  }
  return subscriber;
}

/**
 * Get or create a publisher client
 * @returns {Redis} Redis publisher client
 */
function getPublisher() {
  if (!publisher) {
    publisher = new Redis(redisConfig);
    publisher.on('connect', () => console.log('✅ Redis publisher connected'));
    publisher.on('error', (err) => console.error('❌ Redis publisher error:', err.message));
  }
  return publisher;
}

/**
 * Create a new Redis connection (for BullMQ — it needs its own connections)
 * @returns {Redis} New Redis connection
 */
function createConnection() {
  return new Redis(redisConfig);
}

/**
 * Graceful shutdown — close all Redis connections
 */
async function shutdown() {
  const clients = [client, subscriber, publisher].filter(Boolean);
  await Promise.all(clients.map(c => c.quit().catch(() => c.disconnect())));
  client = null;
  subscriber = null;
  publisher = null;
  console.log('📴 All Redis connections closed');
}

/**
 * Health check
 * @returns {Promise<Object>}
 */
async function healthCheck() {
  try {
    const c = getClient();
    const start = Date.now();
    await c.ping();
    return {
      status: 'healthy',
      latency_ms: Date.now() - start,
      host: REDIS_HOST,
      port: REDIS_PORT,
    };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

module.exports = {
  getClient,
  getSubscriber,
  getPublisher,
  createConnection,
  shutdown,
  healthCheck,
  redisConfig,
};
