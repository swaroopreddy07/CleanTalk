/**
 * SocialConnect App Component
 * 
 * Main application component that sets up the React Router, theme provider,
 * authentication context, and Socket.IO context for the entire application.
 * 
 * Features:
 * - React Router setup with protected routes
 * - Material-UI theme provider with custom styling
 * - Authentication context for user state management
 * - Socket.IO context for real-time features
 * - Route protection for authenticated users
 * 
 * Routes:
 * - Public: /login, /register
 * - Protected: / (home), /messages, /notifications, /search, /activity, /saved, /:username
 * 
 * @author SocialConnect Team
 * @version 1.0.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import PrivateRoute from './components/common/PrivateRoute';
import theme from './theme';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import Search from './pages/Search';
import Activity from './pages/Activity';
import Saved from './pages/Saved';

/**
 * Main App Component
 * 
 * Renders the complete application with all providers and routing configuration.
 * Sets up the component hierarchy and manages global state providers.
 */
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <SocketProvider>
          <Router>
            <Routes>
              {/* Public Routes - No authentication required */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected Routes - Authentication required */}
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/messages"
                element={
                  <PrivateRoute>
                    <Messages />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/notifications"
                element={
                  <PrivateRoute>
                    <Notifications />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/search"
                element={
                  <PrivateRoute>
                    <Search />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/activity"
                element={
                  <PrivateRoute>
                    <Activity />
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/saved"
                element={
                  <PrivateRoute>
                    <Saved />
                  </PrivateRoute>
                }
              />
              
              {/* Dynamic User Profile Route */}
              <Route
                path="/:username"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />
              
              {/* Fallback Route - Redirect to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;