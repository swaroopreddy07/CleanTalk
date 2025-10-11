import React, { useState, useEffect } from 'react';
import { Box, Grid, CircularProgress, Fab, Typography, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import Layout from '../components/Layout/Layout';
import PostCard from '../components/Post/PostCard';
import StoryBar from '../components/Story/StoryBar';
import CreatePost from '../components/Post/CreatePost';
import { postAPI, userAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [followStates, setFollowStates] = useState({}); // Track follow status for each suggestion
  const [loading, setLoading] = useState(true);
  const [createPostOpen, setCreatePostOpen] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    loadFeed();
    loadSuggestions();
  }, []);

  const loadFeed = async () => {
    try {
      const response = await postAPI.getFeedPosts();
      setPosts(response.data.posts || []);
    } catch (error) {
      console.error('Load feed error:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      console.log('🔍 Loading suggestions...');
      const response = await userAPI.getSuggestions();
      console.log('📊 Suggestions API response:', response.data);
      const suggestionsList = (response.data.suggestions || []).slice(0, 5);
      console.log(`✅ Loaded ${suggestionsList.length} suggestions`);
      
      // Debug: Check profile picture URLs
      suggestionsList.forEach((user, index) => {
        console.log(`👤 Suggestion ${index + 1}:`, {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          profile_picture: user.profile_picture,
          full_url: user.profile_picture ? (user.profile_picture.startsWith('http') ? user.profile_picture : `${API_URL}${user.profile_picture}`) : 'No image'
        });
      });
      
      setSuggestions(suggestionsList);
      
      // Initialize follow states for suggestions
      const states = {};
      suggestionsList.forEach(user => {
        states[user.id] = user.follow_status || null;
      });
      setFollowStates(states);
    } catch (error) {
      console.error('❌ Load suggestions error:', error);
      setSuggestions([]);
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  const handlePostDelete = (postId) => {
    setPosts(posts.filter((post) => post.id !== postId));
  };

  const handleFollow = async (userId) => {
    try {
      const currentStatus = followStates[userId];
      
      if (currentStatus === 'accepted' || currentStatus === 'pending') {
        // Unfollow or cancel pending request
        await userAPI.unfollowUser(userId);
        setFollowStates({
          ...followStates,
          [userId]: null
        });
      } else {
        // Send follow request
        await userAPI.followUser(userId);
        setFollowStates({
          ...followStates,
          [userId]: 'pending'
        });
      }
    } catch (error) {
      console.error('Follow error:', error);
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
      <Grid container spacing={3}>
        {/* Main Feed */}
        <Grid item xs={12} md={8}>
          <StoryBar />

          {posts.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                bgcolor: 'background.paper',
                borderRadius: 2,
              }}
            >
              <Typography variant="h6" gutterBottom>
                No posts yet
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Follow users to see their posts in your feed
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/search')}
                sx={{ mt: 2 }}
              >
                Find People
              </Button>
            </Box>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={handlePostDelete}
              />
            ))
          )}
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Box sx={{ position: 'sticky', top: 80 }}>
            {/* Suggested for you */}
            <Box
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                p: 2,
                mb: 2,
              }}
            >
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Suggested for you
              </Typography>

              {suggestions.map((user) => (
                <Box
                  key={user.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 1,
                  }}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    onClick={() => navigate(`/${user.username}`)}
                    sx={{ cursor: 'pointer', flex: 1 }}
                  >
                    <Box
                      component="img"
                      src={user.profile_picture ? (user.profile_picture.startsWith('http') ? user.profile_picture : `${API_URL}${user.profile_picture}`) : '/default-avatar.png'}
                      alt={user.username}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        console.error('❌ Suggested user profile picture failed to load:', user.profile_picture);
                        console.error('❌ Full URL attempted:', user.profile_picture ? (user.profile_picture.startsWith('http') ? user.profile_picture : `${API_URL}${user.profile_picture}`) : 'No image URL');
                        // Hide the broken image
                        e.target.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('✅ Suggested user profile picture loaded successfully:', user.profile_picture);
                      }}
                    />
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {user.display_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        @{user.username}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => handleFollow(user.id)}
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
                    {followStates[user.id] === 'pending' ? 'Requested' : 
                     followStates[user.id] === 'accepted' ? 'Following' : 'Follow'}
                  </Button>
                </Box>
              ))}
            </Box>

        
           
          </Box>
        </Grid>
      </Grid>

     
      <CreatePost
        open={createPostOpen}
        onClose={() => setCreatePostOpen(false)}
        onPostCreated={handlePostCreated}
      />
    </Layout>
  );
};

export default Home;