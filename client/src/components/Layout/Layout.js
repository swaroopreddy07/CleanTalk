import React, { useState } from 'react';
import { Box, Avatar, Typography, IconButton, Badge, Tooltip, Drawer, useMediaQuery } from '@mui/material';
import {
  Home, HomeOutlined, Search, SearchOutlined, Explore, ExploreOutlined,
  ChatBubbleOutline, ChatBubble, FavoriteBorder, Favorite,
  AddCircleOutline, Bookmark, BookmarkBorder,
  Menu as MenuIcon, Logout, Person, Timeline, Settings,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CreatePost from '../Post/CreatePost';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: HomeOutlined, activeIcon: Home },
  { path: '/search', label: 'Search', icon: SearchOutlined, activeIcon: Search },
  { path: '/notifications', label: 'Notifications', icon: FavoriteBorder, activeIcon: Favorite },
  { path: '/messages', label: 'Messages', icon: ChatBubbleOutline, activeIcon: ChatBubble },
  { path: 'create', label: 'Create', icon: AddCircleOutline, activeIcon: AddCircleOutline },
  { path: '/saved', label: 'Saved', icon: BookmarkBorder, activeIcon: Bookmark },
  { path: '/activity', label: 'Activity', icon: Timeline, activeIcon: Timeline },
];

const SIDEBAR_WIDTH = 72;
const SIDEBAR_WIDTH_XL = 240;

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isXL = useMediaQuery('(min-width:1264px)');
  const isMobile = useMediaQuery('(max-width:768px)');

  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

  const handleNavClick = (item) => {
    if (item.path === 'create') { setCreateOpen(true); return; }
    navigate(item.path);
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path === 'create') return false;
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  // Mobile bottom nav
  if (isMobile) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#000', pb: '56px' }}>
        <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>{children}</Box>
        <Box sx={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 56,
          bgcolor: '#000', borderTop: '1px solid #262626',
          display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 1200,
        }}>
          {NAV_ITEMS.slice(0, 5).map(item => {
            const active = isActive(item.path);
            const Icon = active ? item.activeIcon : item.icon;
            return (
              <IconButton key={item.label} onClick={() => handleNavClick(item)} sx={{ color: '#F5F5F5' }}>
                <Icon sx={{ fontSize: 26 }} />
              </IconButton>
            );
          })}
          <IconButton onClick={() => navigate(`/${user?.username}`)} sx={{ p: 0.5 }}>
            <Avatar src={user?.profile_picture ? `${API_URL}${user.profile_picture}` : ''}
              sx={{ width: 26, height: 26, border: location.pathname === `/${user?.username}` ? '2px solid #F5F5F5' : '1px solid #363636' }}>
              {user?.username?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
        </Box>
      </Box>
    );
  }

  // Desktop sidebar
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#000' }}>
      {/* Sidebar */}
      <Box sx={{
        position: 'fixed', left: 0, top: 0, bottom: 0,
        width: isXL ? SIDEBAR_WIDTH_XL : SIDEBAR_WIDTH,
        borderRight: '1px solid #262626',
        bgcolor: '#000',
        display: 'flex', flexDirection: 'column',
        py: 2, px: isXL ? 1.5 : 0,
        zIndex: 1100,
        transition: 'width 0.2s ease',
      }}>
        {/* Logo */}
        <Box sx={{ px: isXL ? 1.5 : 0, py: 2.5, mb: 1, display: 'flex', justifyContent: isXL ? 'flex-start' : 'center' }}>
          {isXL ? (
            <Typography variant="h5" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.5px' }}
              onClick={() => navigate('/')}>
              CleanTalk
            </Typography>
          ) : (
            <Typography variant="h5" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, cursor: 'pointer' }}
              onClick={() => navigate('/')}>
              CT
            </Typography>
          )}
        </Box>

        {/* Nav Items */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.path);
            const Icon = active ? item.activeIcon : item.icon;
            return (
              <Box key={item.label} onClick={() => handleNavClick(item)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  py: 1.5, px: isXL ? 1.5 : 0,
                  borderRadius: 2, cursor: 'pointer',
                  justifyContent: isXL ? 'flex-start' : 'center',
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
                }}>
                <Icon sx={{ fontSize: 26, fontWeight: active ? 700 : 400 }} />
                {isXL && (
                  <Typography variant="body1" sx={{ fontWeight: active ? 700 : 400 }}>
                    {item.label}
                  </Typography>
                )}
              </Box>
            );
          })}

          {/* Profile */}
          <Box onClick={() => navigate(`/${user?.username}`)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 2,
              py: 1.5, px: isXL ? 1.5 : 0,
              borderRadius: 2, cursor: 'pointer',
              justifyContent: isXL ? 'flex-start' : 'center',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
            }}>
            <Avatar src={user?.profile_picture ? `${API_URL}${user.profile_picture}` : ''}
              sx={{
                width: 26, height: 26,
                border: location.pathname === `/${user?.username}` ? '2px solid #F5F5F5' : '1px solid #363636',
              }}>
              {user?.username?.[0]?.toUpperCase()}
            </Avatar>
            {isXL && <Typography variant="body1" sx={{ fontWeight: location.pathname === `/${user?.username}` ? 700 : 400 }}>Profile</Typography>}
          </Box>
        </Box>

        {/* Bottom: More menu */}
        <Box>
          <Box onClick={() => setMoreOpen(!moreOpen)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 2,
              py: 1.5, px: isXL ? 1.5 : 0,
              borderRadius: 2, cursor: 'pointer',
              justifyContent: isXL ? 'flex-start' : 'center',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
            }}>
            <MenuIcon sx={{ fontSize: 26 }} />
            {isXL && <Typography variant="body1">More</Typography>}
          </Box>
          {moreOpen && (
            <Box sx={{
              position: 'absolute', bottom: 64, left: isXL ? 16 : 4,
              bgcolor: '#262626', borderRadius: 2, py: 0.5, width: 200,
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}>
              <Box onClick={() => { navigate('/settings'); setMoreOpen(false); }} sx={{
                display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
              }}>
                <Settings sx={{ fontSize: 20 }} />
                <Typography variant="body2">Settings</Typography>
              </Box>
              <Box onClick={handleLogout} sx={{
                display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
              }}>
                <Logout sx={{ fontSize: 20 }} />
                <Typography variant="body2">Log out</Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, ml: isXL ? `${SIDEBAR_WIDTH_XL}px` : `${SIDEBAR_WIDTH}px`, transition: 'margin-left 0.2s ease' }}>
        <Box sx={{ maxWidth: 820, mx: 'auto', py: 3, px: 2 }}>
          {children}
        </Box>
      </Box>

      <CreatePost open={createOpen} onClose={() => setCreateOpen(false)} onPostCreated={() => { /* Don't close — let CreatePost show AI review status */ }} />
    </Box>
  );
};

export default Layout;