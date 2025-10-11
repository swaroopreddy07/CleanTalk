import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  Box,
} from '@mui/material';
import {
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Message as MessageIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationAPI, messageAPI, userAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import FollowRequestsDialog from '../User/FollowRequestsDialog';


const Header = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [followRequestCount, setFollowRequestCount] = useState(0);
  const [followRequestsOpen, setFollowRequestsOpen] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    loadCounts();

    // Listen for new notifications and messages
    if (socket) {
      socket.on('notification:receive', (notification) => {
        if (notification.type === 'follow_request') {
          setFollowRequestCount((prev) => prev + 1);
        } else {
          setNotificationCount((prev) => prev + 1);
        }
      });

      socket.on('message:receive', () => {
        setMessageCount((prev) => prev + 1);
      });
    }

    return () => {
      if (socket) {
        socket.off('notification:receive');
        socket.off('message:receive');
      }
    };
  }, [socket]);

  const loadCounts = async () => {
    try {
      const [notifRes, msgRes, followRes] = await Promise.all([
        notificationAPI.getUnreadCount(),
        messageAPI.getUnreadCount(),
        userAPI.getFollowRequests(),
      ]);
      setNotificationCount(notifRes.data.count);
      setMessageCount(msgRes.data.count);
      setFollowRequestCount(followRes.data.requests?.length || 0);
    } catch (error) {
      console.error('Failed to load counts:', error);
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  return (
    <AppBar 
      position="sticky" 
      color="inherit" 
      elevation={0}
      sx={{
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Toolbar>
        <Typography
          variant="h5"
          component="div"
          className="gradient-text"
          sx={{ 
            fontWeight: 700, 
            cursor: 'pointer',
            flexShrink: 0,
            fontSize: '1.75rem',
            letterSpacing: '-0.025em',
          }}
          onClick={() => navigate('/')}
        >
          SocialConnect
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            onClick={() => navigate('/search')} 
            color="inherit"
            title="Search"
          >
            <SearchIcon />
          </IconButton>

          <IconButton
            onClick={() => {
              setFollowRequestsOpen(true);
              setFollowRequestCount(0);
            }}
            color="inherit"
          >
            <Badge badgeContent={followRequestCount} color="error">
              <PersonAddIcon />
            </Badge>
          </IconButton>

          <IconButton
            onClick={() => {
              navigate('/messages');
              setMessageCount(0);
            }}
            color="inherit"
          >
            <Badge badgeContent={messageCount} color="error">
              <MessageIcon />
            </Badge>
          </IconButton>

          <IconButton
            onClick={() => {
              navigate('/notifications');
              setNotificationCount(0);
            }}
            color="inherit"
          >
            <Badge badgeContent={notificationCount} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          <IconButton onClick={handleMenuOpen}>
            <Avatar
              src={user?.profile_picture ? (user.profile_picture.startsWith('http') ? user.profile_picture : `${API_URL}${user.profile_picture}`) : ''}
              alt={user?.username}
              sx={{ width: 32, height: 32 }}
            >
              {user?.username?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem
            onClick={() => {
              navigate(`/${user?.username}`);
              handleMenuClose();
            }}
          >
            Profile
          </MenuItem>
          <MenuItem
            onClick={() => {
              navigate('/saved');
              handleMenuClose();
            }}
          >
            Saved
          </MenuItem>
          <MenuItem
            onClick={() => {
              navigate('/activity');
              handleMenuClose();
            }}
          >
            Your Activity
          </MenuItem>
          <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
            Log out
          </MenuItem>
        </Menu>
      </Toolbar>
      
      <FollowRequestsDialog 
        open={followRequestsOpen} 
        onClose={() => setFollowRequestsOpen(false)} 
      />
    </AppBar>
  );
};

export default Header;