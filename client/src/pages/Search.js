import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Button,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { userAPI } from '../services/api';

const Search = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [followStates, setFollowStates] = useState({}); // Track follow status for each user

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (query) {
      handleSearch();
    }
  }, [query]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await userAPI.searchUsers(query);
      const searchResults = response.data.users || [];
      setUsers(searchResults);

      // Initialize follow states for each user
      const initialFollowStates = {};
      searchResults.forEach(user => {
        initialFollowStates[user.id] = user.follow_status || null;
      });
      setFollowStates(initialFollowStates);
    } catch (error) {
      console.error('Search error:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId, currentStatus) => {
    try {
      if (currentStatus === 'accepted') {
        // Unfollow
        await userAPI.unfollowUser(userId);
        setFollowStates(prev => ({
          ...prev,
          [userId]: null
        }));
      } else if (currentStatus === 'pending') {
        // Cancel follow request
        await userAPI.unfollowUser(userId);
        setFollowStates(prev => ({
          ...prev,
          [userId]: null
        }));
      } else {
        // Follow (send request)
        await userAPI.followUser(userId);
        setFollowStates(prev => ({
          ...prev,
          [userId]: 'pending'
        }));
      }
    } catch (error) {
      console.error('Follow/Unfollow error:', error);
    }
  };

  const getFollowButtonProps = (followStatus) => {
    switch (followStatus) {
      case 'accepted':
        return { variant: 'outlined', color: 'inherit', text: 'Following' };
      case 'pending':
        return { variant: 'outlined', color: 'primary', text: 'Requested' };
      default:
        return { variant: 'contained', color: 'primary', text: 'Follow' };
    }
  };

  return (
    <Layout>
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
        <Typography variant="h4" fontWeight={600} gutterBottom>
          Search
        </Typography>

        <TextField
          fullWidth
          placeholder="Search users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : query && (
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Users
            </Typography>
            
            {users.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No users found
                </Typography>
              </Box>
            ) : (
              <List sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
                {users.map((user) => (
                  <ListItem key={user.id}>
                    <Box
                      display="flex"
                      alignItems="center"
                      gap={1}
                      onClick={() => navigate(`/${user.username}`)}
                      sx={{ 
                        cursor: 'pointer', 
                        flex: 1,
                        '&:hover': {
                          backgroundColor: 'action.hover',
                          borderRadius: 1,
                          mx: -1,
                          px: 1
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          src={user.profile_picture ? (user.profile_picture.startsWith('http') ? user.profile_picture : `${API_URL}${user.profile_picture}`) : ''}
                          alt={user.username}
                        >
                          {user.username?.[0]?.toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" fontWeight={600}>
                            {user.username}
                          </Typography>
                        }
                        secondary={user.display_name}
                      />
                    </Box>
                    <Button
                      variant="contained"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent navigation when clicking follow button
                        handleFollow(user.id, followStates[user.id]);
                      }}
                      size="small"
                      sx={{
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
                      {getFollowButtonProps(followStates[user.id]).text}
                    </Button>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </Box>
    </Layout>
  );
};

export default Search;