import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  Avatar,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

const FollowersModal = ({ open, onClose, userId }) => {
  const navigate = useNavigate();
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [followStates, setFollowStates] = useState({});

  useEffect(() => {
    if (open && userId) {
      loadFollowers();
    }
  }, [open, userId]);

  const loadFollowers = async () => {
    setLoading(true);
    try {
      const response = await userAPI.getFollowers(userId);
      console.log('Followers API response:', response.data);
      setFollowers(response.data.followers || []);
      
      // Initialize follow states
      const states = {};
      (response.data.followers || []).forEach(user => {
        console.log(`User ${user.username} follow_status:`, user.follow_status);
        states[user.id] = user.follow_status || null;
      });
      console.log('Followers follow states:', states);
      setFollowStates(states);
    } catch (error) {
      console.error('Error loading followers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId, currentStatus) => {
    try {
      if (currentStatus === 'accepted' || currentStatus === 'pending') {
        // Unfollow or cancel pending request
        await userAPI.unfollowUser(userId);
        setFollowStates(prev => ({
          ...prev,
          [userId]: null
        }));
      } else {
        // Send follow request
        await userAPI.followUser(userId);
        setFollowStates(prev => ({
          ...prev,
          [userId]: 'pending'
        }));
      }
    } catch (error) {
      console.error('Follow error:', error);
      alert(error.response?.data?.message || 'Error updating follow status');
    }
  };

  const handleUserClick = (username) => {
    onClose();
    navigate(`/profile/${username}`);
  };

  const renderList = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress />
        </Box>
      );
    }

    if (followers.length === 0) {
      return (
        <Box textAlign="center" py={4}>
          <Typography variant="body1" color="text.secondary">
            No followers yet
          </Typography>
        </Box>
      );
    }

    return (
      <List>
        {followers.map((user) => (
          <ListItem
            key={user.id}
            sx={{
              py: 2,
              '&:hover': { backgroundColor: 'action.hover' },
              cursor: 'pointer'
            }}
            onClick={() => handleUserClick(user.username)}
          >
            <ListItemAvatar>
              <Avatar
                src={user.profile_picture ? (user.profile_picture.startsWith('http') ? user.profile_picture : `${API_URL}${user.profile_picture}`) : ''}
                alt={user.username}
              />
            </ListItemAvatar>
            <ListItemText
              primary={user.display_name}
              secondary={`@${user.username}`}
              primaryTypographyProps={{ fontWeight: 600 }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleFollow(user.id, followStates[user.id]);
              }}
              sx={{
                minWidth: 100,
                textTransform: 'none',
                fontWeight: 600,
                background: followStates[user.id] === 'pending' ? 
                  'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' :
                  followStates[user.id] === 'accepted' ? 
                  'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)' : 
                  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: followStates[user.id] === 'accepted' ? 'primary.main' : 'white',
                border: followStates[user.id] === 'accepted' ? '2px solid #6366f1' : 'none',
                '&:hover': {
                  background: followStates[user.id] === 'pending' ? 
                    'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' :
                    followStates[user.id] === 'accepted' ? 
                    'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)' : 
                    'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                },
              }}
            >
              {followStates[user.id] === 'pending' ? 'Requested' :
               followStates[user.id] === 'accepted' ? 'Following' : 'Follow'}
            </Button>
          </ListItem>
        ))}
      </List>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700}>
            Followers
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {renderList()}
      </DialogContent>
    </Dialog>
  );
};

export default FollowersModal;