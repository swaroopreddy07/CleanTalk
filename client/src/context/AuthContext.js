/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 * Manages user login, registration, logout, and user data persistence.
 * 
 * Features:
 * - User authentication state management
 * - Token-based authentication with localStorage
 * - Automatic user data loading on app initialization
 * - User profile updates
 * - Secure logout with token cleanup
 * 
 * Context Methods:
 * - login(email, password): Authenticate user and store token
 * - register(userData): Register new user and store token
 * - logout(): Clear token and user data
 * - updateUser(updatedUser): Update current user data
 * 
 * @author SocialConnect Team
 * @version 1.0.0
 */

import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

/**
 * Custom hook to access authentication context
 * 
 * @returns {Object} Authentication context with user, loading, and auth methods
 * @throws {Error} If used outside of AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Authentication Provider Component
 * 
 * Provides authentication state and methods to child components.
 * Manages user session persistence and authentication flow.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Load user data on component mount if token exists
   * Handles token validation and automatic login
   */
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await authAPI.getCurrentUser();
          setUser(response.data.user);
        } catch (error) {
          console.error('Failed to load user:', error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  /**
   * Login user with email and password
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} Login response data
   */
  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
    return response.data;
  };

  /**
   * Register new user
   * 
   * @param {Object} userData - User registration data
   * @returns {Object} Registration response data
   */
  const register = async (userData) => {
    const response = await authAPI.register(userData);
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
    return response.data;
  };

  /**
   * Logout current user
   * Clears token and user data
   */
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  /**
   * Update current user data
   * 
   * @param {Object} updatedUser - Updated user data
   */
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  /**
   * Context value containing authentication state and methods
   */
  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};