/**
 * Database Configuration
 * 
 * This module configures the MySQL database connection for the SocialConnect application.
 * Uses connection pooling for better performance and handles database connectivity.
 * 
 * Features:
 * - Connection pooling for optimal performance
 * - Environment-based configuration
 * - Promise-based interface for async/await support
 * - Automatic connection management
 * 
 * @author SocialConnect Team
 * @version 1.0.0
 */

const mysql = require('mysql2');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

/**
 * MySQL Connection Pool Configuration
 * 
 * Creates a connection pool for better database performance and resource management.
 * The pool automatically manages connections, reuses them when possible, and handles
 * connection failures gracefully.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',           // Database host
  user: process.env.DB_USER || 'root',                // Database username
  password: process.env.DB_PASSWORD || '',            // Database password
  database: process.env.DB_NAME || 'socialconnect',   // Database name
  waitForConnections: true,                           // Wait for available connections
  connectionLimit: 10,                               // Maximum number of connections in pool
  queueLimit: 0,                                     // No limit on connection queue
  acquireTimeout: 60000,                             // Timeout for acquiring connection (60s)
  timeout: 60000,                                    // Query timeout (60s)
  reconnect: true,                                   // Automatically reconnect on connection loss
  charset: 'utf8mb4'                                 // Use UTF-8 character set for full Unicode support
});

/**
 * Promisified Connection Pool
 * 
 * Converts the callback-based MySQL pool to a promise-based interface,
 * allowing the use of async/await syntax throughout the application.
 */
const promisePool = pool.promise();

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 Database connection lost, attempting to reconnect...');
  }
});

// Handle pool connection events
pool.on('connection', (connection) => {
  console.log('✅ New database connection established:', connection.threadId);
});

pool.on('acquire', (connection) => {
  console.log('🔗 Database connection acquired:', connection.threadId);
});

pool.on('release', (connection) => {
  console.log('🔓 Database connection released:', connection.threadId);
});

// Export the promisified pool for use in other modules
module.exports = promisePool;