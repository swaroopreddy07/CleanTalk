/**
 * SocialConnect Server
 * 
 * Main server file for the SocialConnect social media application.
 * Handles HTTP requests, WebSocket connections, file uploads, and API routing.
 * 
 * Features:
 * - RESTful API endpoints for authentication, users, posts, messages, notifications, and stories
 * - Real-time messaging and notifications using Socket.IO
 * - File upload handling with Azure Blob Storage integration
 * - CORS configuration for cross-origin requests
 * - Error handling and logging
 * 
 * @author SocialConnect Team
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
require('dotenv').config();

// ================================
// ROUTE IMPORTS
// ================================
// Import all API route modules
const authRoutes = require('./routes/auth');           // Authentication endpoints (login, register, logout)
const userRoutes = require('./routes/users');          // User management endpoints (profile, follow, search)
const postRoutes = require('./routes/posts');          // Post endpoints (create, like, comment, delete)
const messageRoutes = require('./routes/messages');    // Messaging endpoints (send, receive, conversations)
const notificationRoutes = require('./routes/notifications'); // Notification endpoints (get, mark as read)
const storyRoutes = require('./routes/stories');       // Story endpoints (create, view, delete)

// ================================
// EXPRESS APP INITIALIZATION
// ================================
// Create Express application instance
const app = express();

// Create HTTP server instance
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',  // Allow requests from client
    methods: ['GET', 'POST'],                                   // Allowed HTTP methods
    credentials: true                                           // Allow credentials (cookies, auth headers)
  }
});

// ================================
// MIDDLEWARE CONFIGURATION
// ================================
// Enable CORS for all routes
app.use(cors());

// Parse JSON request bodies (for API requests)
app.use(express.json());

// Parse URL-encoded request bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
// This allows direct access to uploaded images via /uploads/... URLs
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================================
// AZURE BLOB STORAGE PROXY
// ================================
/**
 * Proxy endpoint for Azure Blob Storage images
 * 
 * This endpoint serves images from Azure Blob Storage to avoid CORS issues
 * when the frontend tries to access images directly from Azure URLs.
 * 
 * @route GET /azure-image/:container/:filename
 * @param {string} container - Azure container name (posts, profiles, stories)
 * @param {string} filename - Name of the file in Azure storage
 * @returns {Buffer} Image file as buffer with appropriate headers
 */
app.get('/azure-image/:container/:filename', async (req, res) => {
  try {
    const { container, filename } = req.params;
    const { BlobServiceClient } = require('@azure/storage-blob');
    
    // Initialize Azure Blob Service Client using connection string from environment
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    
    // Get container and blob clients
    const containerClient = blobServiceClient.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(filename);
    
    // Download the blob content
    const downloadResponse = await blobClient.download();
    const chunks = [];
    
    // Read the stream in chunks
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk);
    }
    
    // Combine chunks into a single buffer
    const buffer = Buffer.concat(chunks);
    
    // Set appropriate response headers
    res.set({
      'Content-Type': downloadResponse.contentType,  // Preserve original content type
      'Content-Length': buffer.length,               // Set content length
      'Cache-Control': 'public, max-age=3600'       // Cache for 1 hour
    });
    
    // Send the image buffer
    res.send(buffer);
  } catch (error) {
    console.error('Error proxying Azure image:', error);
    res.status(404).send('Image not found');
  }
});

// ================================
// API ROUTES REGISTRATION
// ================================
// Register all API route modules with their respective prefixes
app.use('/api/auth', authRoutes);           // Authentication: /api/auth/login, /api/auth/register, etc.
app.use('/api/users', userRoutes);          // User management: /api/users/profile, /api/users/follow, etc.
app.use('/api/posts', postRoutes);          // Posts: /api/posts/create, /api/posts/like, etc.
app.use('/api/messages', messageRoutes);    // Messages: /api/messages/send, /api/messages/conversations, etc.
app.use('/api/notifications', notificationRoutes); // Notifications: /api/notifications, /api/notifications/read, etc.
app.use('/api/stories', storyRoutes);       // Stories: /api/stories/create, /api/stories, etc.

// ================================
// HEALTH CHECK ENDPOINT
// ================================
/**
 * Health check endpoint for monitoring server status
 * 
 * @route GET /api/health
 * @returns {Object} Server status information
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ================================
// SOCKET.IO REAL-TIME COMMUNICATION
// ================================
/**
 * Socket.IO Configuration and Event Handlers
 * 
 * Manages real-time communication for:
 * - User presence (online/offline status)
 * - Real-time messaging
 * - Typing indicators
 * - Push notifications
 */

// Data structures to track user connections and typing status
const userSockets = new Map();   // Maps userId -> socketId for direct user targeting
const typingUsers = new Map();   // Maps userId -> typing status for typing indicators

/**
 * Handle new socket connections
 * 
 * @param {Socket} socket - The connected socket instance
 */
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  /**
   * User joins the application with their user ID
   * 
   * @event user:join
   * @param {string|number} userId - The user's unique identifier
   */
  socket.on('user:join', (userId) => {
    if (userId) {
      // Store the mapping between user ID and socket ID
      userSockets.set(userId.toString(), socket.id);
      socket.userId = userId;
      
      // Broadcast to all clients that this user is now online
      io.emit('user:online', userId);
      console.log(`User ${userId} joined (Socket: ${socket.id})`);
    }
  });

  /**
   * Send a real-time message to another user
   * 
   * @event message:send
   * @param {Object} data - Message data
   * @param {string|number} data.receiverId - ID of the message recipient
   * @param {Object} data.message - The message content
   */
  socket.on('message:send', (data) => {
    try {
      const { receiverId, message } = data;
      const receiverSocketId = userSockets.get(receiverId.toString());
      
      // If the recipient is online, send the message directly
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message:receive', message);
      }
    } catch (error) {
      console.error('Message send error:', error);
    }
  });

  /**
   * Start typing indicator for a conversation
   * 
   * @event typing:start
   * @param {Object} data - Typing data
   * @param {string|number} data.receiverId - ID of the user to notify about typing
   */
  socket.on('typing:start', (data) => {
    try {
      const { receiverId } = data;
      const receiverSocketId = userSockets.get(receiverId.toString());
      
      // Notify the recipient that this user is typing
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:start', { userId: socket.userId });
      }
    } catch (error) {
      console.error('Typing start error:', error);
    }
  });

  /**
   * Stop typing indicator for a conversation
   * 
   * @event typing:stop
   * @param {Object} data - Typing data
   * @param {string|number} data.receiverId - ID of the user to notify about stopping typing
   */
  socket.on('typing:stop', (data) => {
    try {
      const { receiverId } = data;
      const receiverSocketId = userSockets.get(receiverId.toString());
      
      // Notify the recipient that this user stopped typing
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:stop', { userId: socket.userId });
      }
    } catch (error) {
      console.error('Typing stop error:', error);
    }
  });

  /**
   * Send a real-time notification to a specific user
   * 
   * @event notification:send
   * @param {Object} data - Notification data
   * @param {string|number} data.userId - ID of the user to notify
   * @param {Object} data.notification - The notification content
   */
  socket.on('notification:send', (data) => {
    try {
      const { userId, notification } = data;
      const userSocketId = userSockets.get(userId.toString());
      
      // If the user is online, send the notification immediately
      if (userSocketId) {
        io.to(userSocketId).emit('notification:receive', notification);
      }
    } catch (error) {
      console.error('Notification send error:', error);
    }
  });

  /**
   * Handle socket disconnection
   * 
   * @event disconnect
   */
  socket.on('disconnect', () => {
    if (socket.userId) {
      // Clean up user tracking data
      userSockets.delete(socket.userId.toString());
      typingUsers.delete(socket.userId.toString());
      
      // Broadcast to all clients that this user is now offline
      io.emit('user:offline', socket.userId);
      console.log(`User ${socket.userId} disconnected`);
    }
  });

  /**
   * Handle socket errors
   * 
   * @event error
   * @param {Error} error - The error that occurred
   */
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Make Socket.IO instance available to controllers for sending notifications
app.set('io', io);

// ================================
// ERROR HANDLING MIDDLEWARE
// ================================

/**
 * 404 Handler - Catch all unmatched routes
 * 
 * This middleware catches any requests that don't match any defined routes
 * and returns a 404 error response.
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

/**
 * Global Error Handler Middleware
 * 
 * Handles all errors that occur during request processing.
 * Provides different error responses based on error type and environment.
 * 
 * @param {Error} err - The error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  
  // Handle multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Please upload files smaller than 5MB.'
    });
  }

  // Handle multer file type errors
  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files (jpeg, jpg, png, gif, webp) are allowed'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Only include error details in development
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ================================
// SERVER STARTUP AND SHUTDOWN
// ================================

// Get port from environment variable or use default
const PORT = process.env.PORT || 5000;

/**
 * Start the HTTP server
 * 
 * Listens on the specified port and logs startup information.
 */
server.listen(PORT, () => {
  console.log(`\n🚀 SocialConnect Server Started Successfully!`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DB_NAME || 'socialconnect'}`);
  console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
  console.log('\n');
});

/**
 * Graceful Shutdown Handler
 * 
 * Handles SIGTERM signal for graceful server shutdown.
 * Allows ongoing requests to complete before closing the server.
 */
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

/**
 * Handle uncaught exceptions
 * 
 * Logs uncaught exceptions and exits the process.
 * This prevents the server from running in an undefined state.
 */
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

/**
 * Handle unhandled promise rejections
 * 
 * Logs unhandled promise rejections and exits the process.
 * This prevents the server from running with unresolved promises.
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});