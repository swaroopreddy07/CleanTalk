import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Switch, Avatar, IconButton, Button,
  FormControl, Select, MenuItem, Divider, Snackbar, Alert,
} from '@mui/material';
import { DarkMode, LightMode, Lock, Message, Block, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isPrivate, setIsPrivate] = useState(true);
  const [messagePrivacy, setMessagePrivacy] = useState('everyone');
  const [theme, setTheme] = useState('dark');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

  useEffect(() => {
    loadSettings();
    loadBlockedUsers();
  }, []);

  const loadSettings = async () => {
    try {
      const r = await userAPI.getUserProfile(user.username);
      const u = r.data.user;
      if (u) {
        setIsPrivate(u.is_private !== undefined ? u.is_private : true);
        setMessagePrivacy(u.message_privacy || 'everyone');
        setTheme(u.theme || 'dark');
      }
    } catch (e) {}
  };

  const loadBlockedUsers = async () => {
    try {
      const r = await userAPI.getBlockedUsers();
      setBlockedUsers(r.data.blocked || []);
    } catch (e) {}
  };

  const handlePrivacyChange = async (field, value) => {
    try {
      if (field === 'is_private') {
        setIsPrivate(value);
        await userAPI.updatePrivacy({ is_private: value });
      } else if (field === 'message_privacy') {
        setMessagePrivacy(value);
        await userAPI.updatePrivacy({ message_privacy: value });
      }
      setSnackbar({ open: true, message: 'Settings updated', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to update', severity: 'error' });
    }
  };

  const handleThemeChange = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    try {
      await userAPI.updateTheme({ theme: newTheme });
      // Store in localStorage for immediate effect
      localStorage.setItem('cleantalk_theme', newTheme);
      setSnackbar({ open: true, message: `Switched to ${newTheme} mode`, severity: 'success' });
      // Dispatch custom event for ThemeContext to pick up
      window.dispatchEvent(new CustomEvent('themeChange', { detail: newTheme }));
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to update theme', severity: 'error' });
    }
  };

  const handleUnblock = async (userId) => {
    try {
      await userAPI.unblockUser(userId);
      setBlockedUsers(prev => prev.filter(b => b.blocked_id !== userId));
      setSnackbar({ open: true, message: 'User unblocked', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to unblock', severity: 'error' });
    }
  };

  const SectionHeader = ({ icon, title }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, mt: 3 }}>
      {icon}
      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>{title}</Typography>
    </Box>
  );

  return (
    <Layout>
      <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, py: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: '#F5F5F5' }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Settings</Typography>
        </Box>

        {/* ── Privacy Section ── */}
        <SectionHeader icon={<Lock sx={{ color: '#A8A8A8' }} />} title="Privacy" />
        
        <Box sx={{ bgcolor: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
          {/* Private Account */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid #262626' }}>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>Private Account</Typography>
              <Typography variant="caption" sx={{ color: '#A8A8A8' }}>
                Only approved followers can see your posts
              </Typography>
            </Box>
            <Switch
              checked={isPrivate}
              onChange={(e) => handlePrivacyChange('is_private', e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#0095F6' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0095F6' },
              }}
            />
          </Box>

          {/* Message Privacy */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                <Message sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                Who can message you
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={messagePrivacy}
                onChange={(e) => handlePrivacyChange('message_privacy', e.target.value)}
                sx={{
                  bgcolor: '#262626', color: '#F5F5F5', borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#363636' },
                  '& .MuiSvgIcon-root': { color: '#A8A8A8' },
                }}
              >
                <MenuItem value="everyone">Everyone</MenuItem>
                <MenuItem value="followers">Followers Only</MenuItem>
                <MenuItem value="nobody">Nobody</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* ── Appearance Section ── */}
        <SectionHeader icon={theme === 'dark' ? <DarkMode sx={{ color: '#A8A8A8' }} /> : <LightMode sx={{ color: '#fbbf24' }} />} title="Appearance" />
        
        <Box sx={{ bgcolor: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#A8A8A8' }}>
                Toggle between dark and light themes
              </Typography>
            </Box>
            <Switch
              checked={theme === 'light'}
              onChange={handleThemeChange}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#fbbf24' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#fbbf24' },
              }}
            />
          </Box>
        </Box>

        {/* ── Blocked Users Section ── */}
        <SectionHeader icon={<Block sx={{ color: '#A8A8A8' }} />} title="Blocked Users" />
        
        <Box sx={{ bgcolor: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
          {blockedUsers.length === 0 ? (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#A8A8A8' }}>
                You haven't blocked anyone
              </Typography>
            </Box>
          ) : (
            blockedUsers.map((b, i) => (
              <Box key={b.blocked_id} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
                borderBottom: i < blockedUsers.length - 1 ? '1px solid #262626' : 'none',
              }}>
                <Avatar
                  src={b.profile_picture ? `${API_URL}${b.profile_picture}` : ''}
                  sx={{ width: 40, height: 40 }}
                >
                  {b.username?.[0]?.toUpperCase()}
                </Avatar>
                <Box flex={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{b.username}</Typography>
                  <Typography variant="caption" sx={{ color: '#A8A8A8' }}>{b.display_name}</Typography>
                </Box>
                <Button size="small" variant="outlined"
                  onClick={() => handleUnblock(b.blocked_id)}
                  sx={{
                    textTransform: 'none', borderColor: '#363636', color: '#F5F5F5', borderRadius: 2,
                    '&:hover': { borderColor: '#ED4956', color: '#ED4956' },
                  }}>
                  Unblock
                </Button>
              </Box>
            ))
          )}
        </Box>

        <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Layout>
  );
};

export default Settings;
