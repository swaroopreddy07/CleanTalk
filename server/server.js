/**
 * SocialConnect Server v2.0
 * 
 * Production-ready with:
 * - Redis cache + BullMQ queue
 * - Socket.IO Redis adapter (multi-instance support)
 * - Async AI moderation via worker pool
 * - Prometheus metrics
 * - Graceful shutdown
 *
 * @version 2.0.0
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
require('dotenv').config();

// Redis & adapters
const { getClient, getSubscriber, getPublisher, shutdown: shutdownRedis } = require('./config/redis');
const { createAdapter } = require('@socket.io/redis-adapter');

// Services
const moderationService = require('./services/moderationService');
const { initQueueEvents, getQueueStats, shutdown: shutdownQueue } = require('./queues/moderationQueue');
const { httpMetricsMiddleware, getMetricsText, getContentType, updateQueueMetrics, updateCacheMetrics } = require('./services/metricsService');
const cacheService = require('./services/cacheService');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const storyRoutes = require('./routes/stories');
const reportRoutes = require('./routes/reports');

// ================================
// EXPRESS APP INITIALIZATION
// ================================
const app = express();
const server = http.createServer(app);

const INSTANCE_ID = process.env.INSTANCE_ID || `backend-${process.pid}`;
console.log(`🏷️  Instance: ${INSTANCE_ID}`);

// ================================
// SOCKET.IO WITH REDIS ADAPTER
// ================================
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Allow load balancer to handle connections
  transports: ['websocket', 'polling'],
});

// Attach Redis adapter for multi-instance Socket.IO
const pubClient = getPublisher();
const subClient = getSubscriber();
io.adapter(createAdapter(pubClient, subClient));
console.log('✅ Socket.IO Redis adapter attached');

// ================================
// MIDDLEWARE
// ================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Prometheus HTTP metrics middleware
app.use(httpMetricsMiddleware);

// ================================
// AZURE BLOB STORAGE PROXY
// ================================
app.get('/azure-image/:container/:filename', async (req, res) => {
  try {
    const { container, filename } = req.params;
    const { BlobServiceClient } = require('@azure/storage-blob');
    
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(filename);
    
    const downloadResponse = await blobClient.download();
    const chunks = [];
    
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    
    res.set({
      'Content-Type': downloadResponse.contentType,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=3600'
    });
    
    res.send(buffer);
  } catch (error) {
    console.error('Error proxying Azure image:', error);
    res.status(404).send('Image not found');
  }
});

// ================================
// API ROUTES
// ================================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/reports', reportRoutes);

// ================================
// HEALTH CHECK ENDPOINT (enhanced)
// ================================
app.get('/api/health', async (req, res) => {
  const redisHealth = await require('./config/redis').healthCheck();
  const queueHealth = await getQueueStats();

  res.json({ 
    success: true, 
    message: 'Server is running',
    instance: INSTANCE_ID,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: redisHealth,
    queue: {
      name: queueHealth.name,
      waiting: queueHealth.waiting,
      active: queueHealth.active,
      failed: queueHealth.failed,
    },
  });
});

// ================================
// PROMETHEUS METRICS ENDPOINT
// ================================
app.get('/api/metrics', async (req, res) => {
  try {
    // Update queue and cache metrics before scrape
    const queueStats = await getQueueStats();
    updateQueueMetrics(queueStats);
    updateCacheMetrics(cacheService.getMetrics());

    const metrics = await getMetricsText();
    res.set('Content-Type', getContentType());
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error collecting metrics');
  }
});

// ================================
// SOCKET.IO
// ================================
const userSockets = new Map();
const typingUsers = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (${INSTANCE_ID})`);

  socket.on('user:join', (userId) => {
    if (userId) {
      userSockets.set(userId.toString(), socket.id);
      socket.userId = userId;
      io.emit('user:online', userId);
      console.log(`User ${userId} joined (Socket: ${socket.id})`);
    }
  });

  socket.on('message:send', (data) => {
    try {
      const { receiverId, message } = data;
      const receiverSocketId = userSockets.get(receiverId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message:receive', message);
      }
    } catch (error) {
      console.error('Message send error:', error);
    }
  });

  socket.on('typing:start', (data) => {
    try {
      const { receiverId } = data;
      const receiverSocketId = userSockets.get(receiverId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:start', { userId: socket.userId });
      }
    } catch (error) {
      console.error('Typing start error:', error);
    }
  });

  socket.on('typing:stop', (data) => {
    try {
      const { receiverId } = data;
      const receiverSocketId = userSockets.get(receiverId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:stop', { userId: socket.userId });
      }
    } catch (error) {
      console.error('Typing stop error:', error);
    }
  });

  socket.on('notification:send', (data) => {
    try {
      const { userId, notification } = data;
      const userSocketId = userSockets.get(userId.toString());
      if (userSocketId) {
        io.to(userSocketId).emit('notification:receive', notification);
      }
    } catch (error) {
      console.error('Notification send error:', error);
    }
  });

  // ── Read Receipts ──
  socket.on('message:delivered', (data) => {
    try {
      const { senderId, messageId } = data;
      const senderSocketId = userSockets.get(senderId.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit('message:delivered', { messageId });
      }
    } catch (error) {
      console.error('Message delivered error:', error);
    }
  });

  socket.on('message:read', (data) => {
    try {
      const { senderId, conversationUserId } = data;
      const senderSocketId = userSockets.get(senderId.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit('message:read', { readBy: socket.userId, conversationUserId });
      }
    } catch (error) {
      console.error('Message read error:', error);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(socket.userId.toString());
      typingUsers.delete(socket.userId.toString());
      io.emit('user:offline', socket.userId);
      console.log(`User ${socket.userId} disconnected`);
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

app.set('io', io);

// ================================
// MODERATION RESULT LISTENER
// ================================
// Subscribes to Redis pub/sub for AI worker results
// Forwards moderation decisions to clients via Socket.IO
moderationService.initModerationListener(io, userSockets);

// Initialize BullMQ event listeners
initQueueEvents(
  (jobId, returnvalue) => {
    console.log(`✅ Moderation job completed: ${jobId}`);
  },
  (jobId, failedReason) => {
    console.error(`❌ Moderation job failed: ${jobId} — ${failedReason}`);
  }
);

// ================================
// PERIODIC METRICS UPDATE
// ================================
const metricsInterval = setInterval(async () => {
  try {
    const queueStats = await getQueueStats();
    updateQueueMetrics(queueStats);
    updateCacheMetrics(cacheService.getMetrics());
  } catch (error) {
    // Silently ignore metrics errors
  }
}, 15000); // Every 15 seconds

// ================================
// ERROR HANDLING
// ================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Please upload files smaller than 5MB.'
    });
  }

  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files (jpeg, jpg, png, gif, webp) are allowed'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ================================
// SERVER STARTUP
// ================================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`\n🚀 SocialConnect Server v2.0 Started!`);
  console.log(`📡 Instance: ${INSTANCE_ID} on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DB_NAME || 'socialconnect'}`);
  console.log(`📦 Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
  console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics`);
  console.log('\n');
});

// ================================
// GRACEFUL SHUTDOWN
// ================================
async function gracefulShutdown(signal) {
  console.log(`\n📴 ${signal} received, shutting down gracefully...`);
  clearInterval(metricsInterval);

  server.close(async () => {
    try {
      await shutdownQueue();
      await shutdownRedis();
      console.log('✅ All connections closed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});