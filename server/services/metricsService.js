/**
 * Prometheus Metrics Service
 * 
 * Exposes application metrics for Prometheus scraping.
 * Tracks: HTTP requests, moderation queue, cache performance, worker status.
 *
 * @version 2.0.0
 */

const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, event loop lag, etc.)
promClient.collectDefaultMetrics({ register, prefix: 'socialconnect_' });

// ================================
// HTTP Metrics
// ================================

const httpRequestDuration = new promClient.Histogram({
  name: 'socialconnect_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestsTotal = new promClient.Counter({
  name: 'socialconnect_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ================================
// Moderation Queue Metrics
// ================================

const moderationQueueLength = new promClient.Gauge({
  name: 'socialconnect_moderation_queue_length',
  help: 'Current number of jobs in the moderation queue',
  labelNames: ['state'], // waiting, active, delayed
  registers: [register],
});

const moderationJobsTotal = new promClient.Counter({
  name: 'socialconnect_moderation_jobs_total',
  help: 'Total moderation jobs processed',
  labelNames: ['action', 'content_type'], // allow/warn/block, comment/caption
  registers: [register],
});

const moderationProcessingTime = new promClient.Histogram({
  name: 'socialconnect_moderation_processing_seconds',
  help: 'Time to process a moderation job (from queue to completion)',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// ================================
// Cache Metrics
// ================================

const cacheHitsTotal = new promClient.Counter({
  name: 'socialconnect_cache_hits_total',
  help: 'Total cache hits',
  registers: [register],
});

const cacheMissesTotal = new promClient.Counter({
  name: 'socialconnect_cache_misses_total',
  help: 'Total cache misses',
  registers: [register],
});

const cacheHitRate = new promClient.Gauge({
  name: 'socialconnect_cache_hit_rate',
  help: 'Cache hit rate percentage',
  registers: [register],
});

// ================================
// Worker Metrics
// ================================

const workerUtilization = new promClient.Gauge({
  name: 'socialconnect_worker_utilization',
  help: 'Worker utilization percentage',
  labelNames: ['worker_id'],
  registers: [register],
});

const blockedContentTotal = new promClient.Counter({
  name: 'socialconnect_blocked_content_total',
  help: 'Total content blocked by moderation',
  labelNames: ['content_type'],
  registers: [register],
});

const warnedContentTotal = new promClient.Counter({
  name: 'socialconnect_warned_content_total',
  help: 'Total content warned by moderation',
  labelNames: ['content_type'],
  registers: [register],
});

// ================================
// Express Middleware
// ================================

/**
 * Express middleware to track HTTP request metrics
 */
function httpMetricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;
    const route = req.route ? req.route.path : req.path;
    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode,
    };

    httpRequestDuration.observe(labels, durationSec);
    httpRequestsTotal.inc(labels);
  });

  next();
}

/**
 * Update queue metrics (called periodically)
 */
async function updateQueueMetrics(queueStats) {
  if (queueStats) {
    moderationQueueLength.set({ state: 'waiting' }, queueStats.waiting || 0);
    moderationQueueLength.set({ state: 'active' }, queueStats.active || 0);
    moderationQueueLength.set({ state: 'delayed' }, queueStats.delayed || 0);
  }
}

/**
 * Update cache metrics
 */
function updateCacheMetrics(cacheStats) {
  if (cacheStats) {
    const total = cacheStats.hits + cacheStats.misses;
    if (total > 0) {
      cacheHitRate.set((cacheStats.hits / total) * 100);
    }
  }
}

/**
 * Record a moderation result
 */
function recordModerationResult(action, contentType, processingTimeSec) {
  moderationJobsTotal.inc({ action, content_type: contentType });
  if (processingTimeSec) {
    moderationProcessingTime.observe(processingTimeSec);
  }
  if (action === 'block') blockedContentTotal.inc({ content_type: contentType });
  if (action === 'warn') warnedContentTotal.inc({ content_type: contentType });
}

/**
 * Get metrics in Prometheus format
 * @returns {Promise<string>}
 */
async function getMetricsText() {
  return register.metrics();
}

/**
 * Get content type for Prometheus response
 */
function getContentType() {
  return register.contentType;
}

module.exports = {
  httpMetricsMiddleware,
  updateQueueMetrics,
  updateCacheMetrics,
  recordModerationResult,
  getMetricsText,
  getContentType,
  register,
  // Individual metrics for direct use
  cacheHitsTotal,
  cacheMissesTotal,
  workerUtilization,
};
