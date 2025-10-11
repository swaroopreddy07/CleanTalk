import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Button,
  Divider,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { notificationAPI, userAPI } from '../services/api';

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    loadNotifications();
    markAllAsRead();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await notificationAPI.getNotifications();
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Load notifications error:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationAPI.deleteNotification(id);
      setNotifications(notifications.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Delete notification error:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (notification.type === 'follow') {
      navigate(`/${notification.sender_username}`);
    } else if (notification.post_id) {
      navigate(`/post/${notification.post_id}`);
    }
  };

  const getNotificationText = (notification) => {
    switch (notification.type) {
      case 'like':
        return 'liked your photo';
      case 'comment':
        return `commented: ${notification.message || notification.content || 'on your post'}`;
      case 'follow':
        return 'started following you';
      case 'follow_request':
        return 'sent you a follow request';
      case 'follow_accepted':
        return 'accepted your follow request';
      case 'mention':
        return `mentioned you in a comment: ${notification.message || notification.content || ''}`;
      default:
        return 'interacted with your content';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'follow':
        return '👤';
      case 'follow_request':
        return '👥';
      case 'follow_accepted':
        return '✅';
      case 'mention':
        return '📝';
      default:
        return '🔔';
    }
  };

  if (loading) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h5" fontWeight={600}>
            Notifications
          </Typography>
          {notifications.length > 0 && (
            <Button
              size="small"
              onClick={markAllAsRead}
              sx={{ color: 'primary.main' }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        {notifications.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              bgcolor: 'background.paper',
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" gutterBottom>
              No notifications yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              When someone likes or comments on your posts, you'll see it here
            </Typography>
          </Box>
        ) : (
          <List sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    bgcolor: notification.is_read ? 'transparent' : 'action.selected',
                  }}
                  onClick={() => handleNotificationClick(notification)}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notification.id);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemAvatar>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar
                        src={
                          notification.sender_profile_picture
                            ? (notification.sender_profile_picture.startsWith('http') 
                                ? notification.sender_profile_picture 
                                : `${API_URL}${notification.sender_profile_picture}`)
                            : ''
                        }
                        alt={notification.sender_username}
                        onError={(e) => {
                          console.error('❌ Notification profile picture failed to load:', notification.sender_profile_picture);
                          e.target.style.display = 'none';
                        }}
                        onLoad={() => {
                          console.log('✅ Notification profile picture loaded:', notification.sender_profile_picture);
                        }}
                      >
                        {notification.sender_username?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: -4,
                          right: -4,
                          width: 24,
                          height: 24,
                          bgcolor: 'background.paper',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                        }}
                      >
                        {getNotificationIcon(notification.type)}
                      </Box>
                    </Box>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2">
                        <Typography component="span" fontWeight={600}>
                          {notification.sender_username}
                        </Typography>{' '}
                        {getNotificationText(notification)}
                      </Typography>
                    }
                    secondary={formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                    })}
                  />
                  {notification.post_image && (
                    <Box
                      component="img"
                      src={
                        notification.post_image.startsWith('http') 
                          ? notification.post_image 
                          : `${API_URL}${notification.post_image}`
                      }
                      alt="Post"
                      sx={{
                        width: 44,
                        height: 44,
                        objectFit: 'cover',
                        borderRadius: 1,
                        ml: 2,
                      }}
                      onError={(e) => {
                        console.error('❌ Notification post image failed to load:', notification.post_image);
                        e.target.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('✅ Notification post image loaded:', notification.post_image);
                      }}
                    />
                  )}
                </ListItem>
                {index < notifications.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    </Layout>
  );
};

export default Notifications;