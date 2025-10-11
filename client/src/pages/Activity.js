import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Grid,
  CircularProgress,
  Card,
  CardMedia,
  CardContent,
} from '@mui/material';
import Layout from '../components/Layout/Layout';
import { postAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const Activity = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [likedPosts, setLikedPosts] = useState([]);
  const [commentedPosts, setCommentedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    loadActivity();
  }, [tab]);

  const loadActivity = async () => {
    setLoading(true);
    try {
      if (tab === 0) {
        const response = await postAPI.getLikedPosts();
        setLikedPosts(response.data.posts || []);
      } else {
        const response = await postAPI.getCommentedPosts();
        setCommentedPosts(response.data.posts || []);
      }
    } catch (error) {
      console.error('Load activity error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderPosts = (posts, type) => {
    if (posts.length === 0) {
      return (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            bgcolor: 'background.paper',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            No {type} yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Posts you {type} will appear here
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        {posts.map((post) => (
          <Card
            key={post.id}
            sx={{
              display: 'flex',
              gap: 2,
              p: 2,
              mb: 2,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
            onClick={() => navigate(`/post/${post.id}`)}
          >
            <CardMedia
              component="img"
              image={
                post.image_url
                  ? (post.image_url.startsWith('http') 
                      ? post.image_url 
                      : `${API_URL}${post.image_url}`)
                  : '/default-post.png'
              }
              alt="Post"
              sx={{
                width: 80,
                height: 80,
                objectFit: 'cover',
                borderRadius: 1,
              }}
              onError={(e) => {
                console.error('❌ Activity post image failed to load:', post.image_url);
                console.error('❌ Full URL attempted:', post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`) : 'No image URL');
                e.target.src = '/default-post.png';
              }}
              onLoad={() => {
                console.log('✅ Activity post image loaded successfully:', post.image_url);
              }}
            />
            <CardContent sx={{ flex: 1, p: 0, '&:last-child': { pb: 0 } }}>
              <Typography variant="body2">
                <Typography component="span" fontWeight={600}>
                  You {type === 'likes' ? 'liked' : 'commented on'} @{post.username}'s photo
                </Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDistanceToNow(new Date(type === 'likes' ? post.liked_at : post.commented_at), {
                  addSuffix: true,
                })}
              </Typography>
              {post.caption && post.caption.trim() && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {post.caption.trim()}
                </Typography>
              )}
              {type === 'comments' && post.comment_content && post.comment_content.trim() && (
                <Typography
                  variant="body2"
                  color="primary"
                  sx={{ 
                    mt: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  Your comment: "{post.comment_content.trim()}"
                </Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  return (
    <Layout>
      <Box sx={{ maxWidth: 935, mx: 'auto' }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={600}>
            Your Activity
          </Typography>
        </Box>

        <Tabs value={tab} onChange={(e, newValue) => setTab(newValue)} sx={{ mb: 3 }}>
          <Tab label={`Likes (${likedPosts.length})`} />
          <Tab label={`Comments (${commentedPosts.length})`} />
        </Tabs>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {tab === 0 && renderPosts(likedPosts, 'likes')}
            {tab === 1 && renderPosts(commentedPosts, 'comments')}
          </>
        )}
      </Box>
    </Layout>
  );
};

export default Activity;