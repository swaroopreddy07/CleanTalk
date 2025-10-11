/**
 * Socket.IO Context
 * 
 * Provides real-time communication functionality throughout the application.
 * Manages WebSocket connections, online user tracking, and real-time messaging.
 * 
 * Features:
 * - Real-time messaging and notifications
 * - Online/offline user status tracking
 * - Typing indicators for messaging
 * - Automatic connection management based on authentication
 * - Socket event handling and emission
 * 
 * Context Methods:
 * - sendMessage(receiverId, message): Send real-time message
 * - sendNotification(userId, notification): Send notification
 * - startTyping(receiverId): Start typing indicator
 * - stopTyping(receiverId): Stop typing indicator
 * 
 * @author SocialConnect Team
 * @version 1.0.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

/**
 * Custom hook to access Socket.IO context
 * 
 * @returns {Object} Socket context with socket instance and methods
 * @throws {Error} If used outside of SocketProvider
 */
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

// Socket.IO server URL - defaults to localhost:5000 for development
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

/**
 * Socket.IO Provider Component
 * 
 * Provides Socket.IO connection and real-time functionality to child components.
 * Manages socket connection lifecycle and online user tracking.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const { user } = useAuth();

  /**
   * Initialize Socket.IO connection when user is authenticated
   * Sets up event listeners for online/offline status and manages connection lifecycle
   */
  useEffect(() => {
    if (user) {
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);

      // Join with user ID for server-side user tracking
      newSocket.emit('user:join', user.id);

      // Listen for online/offline events
      newSocket.on('user:online', (userId) => {
        setOnlineUsers((prev) => new Set([...prev, userId]));
      });

      newSocket.on('user:offline', (userId) => {
        setOnlineUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      });

      // Cleanup function to disconnect socket when component unmounts
      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  /**
   * Send real-time message to another user
   * 
   * @param {number} receiverId - ID of the user receiving the message
   * @param {string} message - Message content
   */
  const sendMessage = (receiverId, message) => {
    if (socket) {
      socket.emit('message:send', { receiverId, message });
    }
  };

  /**
   * Send real-time notification to a user
   * 
   * @param {number} userId - ID of the user receiving the notification
   * @param {Object} notification - Notification data
   */
  const sendNotification = (userId, notification) => {
    if (socket) {
      socket.emit('notification:send', { userId, notification });
    }
  };

  /**
   * Start typing indicator for a conversation
   * 
   * @param {number} receiverId - ID of the user in the conversation
   */
  const startTyping = (receiverId) => {
    if (socket) {
      socket.emit('typing:start', { receiverId });
    }
  };

  /**
   * Stop typing indicator for a conversation
   * 
   * @param {number} receiverId - ID of the user in the conversation
   */
  const stopTyping = (receiverId) => {
    if (socket) {
      socket.emit('typing:stop', { receiverId });
    }
  };

  /**
   * Context value containing socket instance and real-time methods
   */
  const value = {
    socket,
    onlineUsers,
    sendMessage,
    sendNotification,
    startTyping,
    stopTyping,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};