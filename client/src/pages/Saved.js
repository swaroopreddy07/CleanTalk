import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, CircularProgress } from '@mui/material';
import { BookmarkBorder } from '@mui/icons-material';
import Layout from '../components/Layout/Layout';
import PostModal from '../components/Post/PostModal';
import { postAPI } from '../services/api';

const Saved = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

  useEffect(() => { loadSaved(); }, []);
  const loadSaved = async () => { try { const r = await postAPI.getSavedPosts(); setPosts(r.data.posts || []); } catch (e) { setPosts([]); } finally { setLoading(false); } };

  if (loading) return <Layout><Box display="flex" justifyContent="center" py={8}><CircularProgress sx={{ color: '#A8A8A8' }} /></Box></Layout>;

  return (
    <Layout>
      <Box sx={{ maxWidth: 935, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Saved</Typography>
        {posts.length === 0 ? (
          <Box textAlign="center" py={8}>
            <BookmarkBorder sx={{ fontSize: 40, color: '#A8A8A8', mb: 1 }} />
            <Typography sx={{ color: '#A8A8A8' }}>No saved posts yet</Typography>
          </Box>
        ) : (
          <Grid container spacing={0.4}>
            {posts.map(p => (
              <Grid item xs={4} key={p.id}>
                <Box sx={{ position: 'relative', paddingTop: '100%', cursor: 'pointer', '&:hover .ov': { opacity: 1 } }} onClick={() => setSelectedPost(p.id)}>
                  <Box component="img" src={p.image_url ? (p.image_url.startsWith('http') ? p.image_url : `${API_URL}${p.image_url}`) : ''} alt=""
                    sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  <Box className="ov" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, opacity: 0, transition: 'opacity 0.2s', color: '#fff' }}>
                    <Typography fontWeight={700}>❤️ {p.likes_count}</Typography>
                    <Typography fontWeight={700}>💬 {p.comments_count}</Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
      {selectedPost && <PostModal open={!!selectedPost} onClose={() => setSelectedPost(null)} postId={selectedPost} />}
    </Layout>
  );
};

export default Saved;