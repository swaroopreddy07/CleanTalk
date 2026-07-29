import React, { useState, useEffect } from 'react';
import { Box, Typography, Tabs, Tab, CircularProgress } from '@mui/material';
import { Favorite, ChatBubble } from '@mui/icons-material';
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
  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

  useEffect(() => { loadActivity(); }, [tab]);
  const loadActivity = async () => {
    setLoading(true);
    try {
      if (tab === 0) { const r = await postAPI.getLikedPosts(); setLikedPosts(r.data.posts || []); }
      else { const r = await postAPI.getCommentedPosts(); setCommentedPosts(r.data.posts || []); }
    } catch (e) {} finally { setLoading(false); }
  };

  const posts = tab === 0 ? likedPosts : commentedPosts;
  const type = tab === 0 ? 'likes' : 'comments';

  return (
    <Layout>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Your Activity</Typography>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Likes" />
          <Tab label="Comments" />
        </Tabs>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} sx={{ color: '#A8A8A8' }} /></Box>
        ) : posts.length === 0 ? (
          <Box textAlign="center" py={8}><Typography sx={{ color: '#A8A8A8' }}>No {type} yet</Typography></Box>
        ) : (
          posts.map(p => (
            <Box key={p.id} onClick={() => navigate(`/post/${p.id}`)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, px: 1, cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
              {p.image_url && (
                <Box component="img" src={p.image_url.startsWith('http') ? p.image_url : `${API_URL}${p.image_url}`}
                  alt="" sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 0.5, flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />
              )}
              <Box flex={1}>
                <Typography variant="body2">
                  {type === 'likes' ? <Favorite sx={{ fontSize: 12, color: '#ED4956', mr: 0.5, verticalAlign: 'middle' }} /> :
                    <ChatBubble sx={{ fontSize: 12, color: '#A8A8A8', mr: 0.5, verticalAlign: 'middle' }} />}
                  You {type === 'likes' ? 'liked' : 'commented on'} <Typography component="span" sx={{ fontWeight: 600 }}>@{p.username}</Typography>'s post
                </Typography>
                <Typography variant="caption" sx={{ color: '#A8A8A8' }}>
                  {formatDistanceToNow(new Date(type === 'likes' ? p.liked_at : p.commented_at), { addSuffix: true })}
                </Typography>
                {type === 'comments' && p.comment_content?.trim() && (
                  <Typography variant="body2" sx={{ color: '#A8A8A8', mt: 0.3, fontStyle: 'italic', fontSize: '0.8rem' }}>"{p.comment_content.trim()}"</Typography>
                )}
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Layout>
  );
};

export default Activity;