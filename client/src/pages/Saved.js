import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { GridOn as GridIcon, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import PostModal from '../components/Post/PostModal';
import { postAPI } from '../services/api';

const Saved = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    loadSavedPosts();
  }, []);

  const loadSavedPosts = async () => {
    try {
      console.log('🔍 Loading saved posts...');
      const response = await postAPI.getSavedPosts();
      console.log('📊 Saved posts API response:', response.data);
      const savedPosts = response.data.posts || [];
      console.log(`✅ Loaded ${savedPosts.length} saved posts`);
      
      // Debug: Check image URLs
      savedPosts.forEach((post, index) => {
        console.log(`📸 Post ${index + 1}:`, {
          id: post.id,
          image_url: post.image_url,
          full_url: post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`) : 'No image'
        });
      });
      
      setPosts(savedPosts);
    } catch (error) {
      console.error('❌ Load saved posts error:', error);
      setPosts([]);
    } finally {
      setLoading(false);
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
      <Box sx={{ maxWidth: 935, mx: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 3,
          }}
        >
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" fontWeight={600}>
            Saved Posts
          </Typography>
          <GridIcon sx={{ ml: 'auto' }} />
        </Box>

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
              No saved posts yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              When you save posts, they'll appear here. Look for the bookmark icon on posts to save them for later.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={1}>
            {posts.map((post) => (
              <Grid item xs={4} key={post.id}>
                <Box
                  sx={{
                    position: 'relative',
                    paddingTop: '100%',
                    cursor: 'pointer',
                    '&:hover .overlay': {
                      opacity: 1,
                    },
                  }}
                  onClick={() => setSelectedPost(post.id)}
                >
                  <Box
                    component="img"
                    src={post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`) : ''}
                    alt="Post"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      console.error('❌ Saved post image failed to load:', post.image_url);
                      console.error('❌ Full URL attempted:', post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`) : 'No image URL');
                      // Hide the broken image
                      e.target.style.display = 'none';
                    }}
                    onLoad={() => {
                      console.log('✅ Saved post image loaded successfully:', post.image_url);
                    }}
                  />
                  <Box
                    className="overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      bgcolor: 'rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      opacity: 0,
                      transition: 'opacity 0.3s',
                      color: 'white',
                    }}
                  >
                    <Typography>❤️ {post.likes_count}</Typography>
                    <Typography>💬 {post.comments_count}</Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {selectedPost && (
        <PostModal
          open={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          postId={selectedPost}
        />
      )}
    </Layout>
  );
};

export default Saved;