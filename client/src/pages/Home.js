import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, CircularProgress, Avatar, Button, Skeleton } from '@mui/material';
import Layout from '../components/Layout/Layout';
import PostCard from '../components/Post/PostCard';
import StoryBar from '../components/Story/StoryBar';
import { postAPI, userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Skeleton placeholder for loading posts
const PostSkeleton = () => (
  <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid #262626' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
      <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: '#262626' }} />
      <Skeleton variant="text" width={120} sx={{ bgcolor: '#262626' }} />
    </Box>
    <Skeleton variant="rectangular" width="100%" height={300} sx={{ bgcolor: '#1a1a1a', borderRadius: 1, mb: 1 }} />
    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
      <Skeleton variant="circular" width={28} height={28} sx={{ bgcolor: '#262626' }} />
      <Skeleton variant="circular" width={28} height={28} sx={{ bgcolor: '#262626' }} />
    </Box>
    <Skeleton variant="text" width={80} sx={{ bgcolor: '#262626', mb: 0.5 }} />
    <Skeleton variant="text" width="60%" sx={{ bgcolor: '#262626' }} />
  </Box>
);

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [followStates, setFollowStates] = useState({});
  const observerRef = useRef(null);
  const PAGE_SIZE = 10;

  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

  useEffect(() => { loadFeed(0, true); loadSuggestions(); }, []); // eslint-disable-line

  const loadFeed = async (pageNum = 0, isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const response = await postAPI.getFeedPosts({ limit: PAGE_SIZE, offset: pageNum * PAGE_SIZE });
      const newPosts = response.data.posts || [];
      
      if (isInitial) {
        setPosts(newPosts);
      } else {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNew = newPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
      }

      setHasMore(response.data.hasMore !== false && newPosts.length >= PAGE_SIZE);
      setPage(pageNum);
    } catch (error) { console.error('Load feed error:', error); }
    finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Intersection Observer for infinite scroll
  const lastPostRef = useCallback(node => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadFeed(page + 1, false);
      }
    }, { threshold: 0.5 });
    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMore, page]); // eslint-disable-line

  const loadSuggestions = async () => {
    try {
      const response = await userAPI.getSuggestions ? await userAPI.getSuggestions() : await userAPI.getUsers();
      const userList = response.data.suggestions || response.data.users || [];
      setSuggestions(userList.slice(0, 5));
      const states = {};
      userList.forEach(u => { states[u.id] = u.follow_status || null; });
      setFollowStates(states);
    } catch (error) { console.error('Load suggestions error:', error); }
  };

  const handleFollow = async (userId) => {
    try {
      if (followStates[userId]) {
        await userAPI.unfollowUser(userId);
        setFollowStates(prev => ({ ...prev, [userId]: null }));
      } else {
        await userAPI.followUser(userId);
        setFollowStates(prev => ({ ...prev, [userId]: 'pending' }));
      }
    } catch (error) { console.error('Follow error:', error); }
  };

  const handleDeletePost = (postId) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  return (
    <Layout>
      <Box sx={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {/* ── Main Feed ── */}
        <Box sx={{ maxWidth: 470, width: '100%' }}>
          <StoryBar />

          {loading ? (
            <Box>
              {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
            </Box>
          ) : posts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" sx={{ color: '#F5F5F5', mb: 1 }}>No posts yet</Typography>
              <Typography variant="body2" sx={{ color: '#A8A8A8', mb: 3 }}>
                Follow users to see their posts in your feed
              </Typography>
              <Button variant="contained" onClick={() => navigate('/search')} sx={{ borderRadius: 2 }}>
                Find People
              </Button>
            </Box>
          ) : (
            <>
              {posts.map((post, index) => {
                if (index === posts.length - 1) {
                  return (
                    <div ref={lastPostRef} key={post.id}>
                      <PostCard post={post} onDelete={handleDeletePost} />
                    </div>
                  );
                }
                return <PostCard key={post.id} post={post} onDelete={handleDeletePost} />;
              })}

              {/* Loading more indicator */}
              {loadingMore && (
                <Box>
                  <PostSkeleton />
                </Box>
              )}

              {/* End of feed */}
              {!hasMore && posts.length > 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" sx={{ color: '#A8A8A8' }}>
                    ✓ You're all caught up
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>

        {/* ── Right Sidebar (Suggestions) ── */}
        <Box sx={{ width: 320, flexShrink: 0, pt: 2, display: { xs: 'none', lg: 'block' } }}>
          {/* Current user */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Avatar
              src={user?.profile_picture ? `${API_URL}${user.profile_picture}` : ''}
              onClick={() => navigate(`/${user?.username}`)}
              sx={{ width: 44, height: 44, cursor: 'pointer' }}>
              {user?.username?.[0]?.toUpperCase()}
            </Avatar>
            <Box flex={1} onClick={() => navigate(`/${user?.username}`)} sx={{ cursor: 'pointer' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#F5F5F5' }}>{user?.username}</Typography>
              <Typography variant="caption" sx={{ color: '#A8A8A8' }}>{user?.display_name}</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#0095F6', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}>
              Switch
            </Typography>
          </Box>

          {/* Suggestions header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#A8A8A8' }}>
              Suggested for you
            </Typography>
            <Typography variant="caption" sx={{ color: '#F5F5F5', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
              onClick={() => navigate('/search')}>
              See All
            </Typography>
          </Box>

          {/* Suggestion list */}
          {suggestions.map(s => (
            <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Avatar src={s.profile_picture ? (s.profile_picture.startsWith('http') ? s.profile_picture : `${API_URL}${s.profile_picture}`) : ''}
                onClick={() => navigate(`/${s.username}`)}
                sx={{ width: 32, height: 32, cursor: 'pointer' }}>
                {s.username?.[0]?.toUpperCase()}
              </Avatar>
              <Box flex={1} minWidth={0}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', '&:hover': { opacity: 0.7 } }}
                  onClick={() => navigate(`/${s.username}`)} noWrap>
                  {s.username}
                </Typography>
                <Typography variant="caption" sx={{ color: '#A8A8A8', fontSize: '0.7rem' }} noWrap>
                  {s.display_name || 'Suggested for you'}
                </Typography>
              </Box>
              <Typography variant="caption"
                onClick={() => handleFollow(s.id)}
                sx={{
                  color: followStates[s.id] ? '#A8A8A8' : '#0095F6',
                  fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem',
                  '&:hover': { color: followStates[s.id] ? '#ccc' : '#fff' },
                }}>
                {followStates[s.id] === 'pending' ? 'Requested' : followStates[s.id] === 'accepted' ? 'Following' : 'Follow'}
              </Typography>
            </Box>
          ))}

          {/* Footer */}
          <Box sx={{ mt: 4, color: '#363636', fontSize: '0.68rem' }}>
            <Typography variant="caption" sx={{ color: '#363636', fontSize: '0.68rem' }}>
              About · Help · Press · API · Jobs · Privacy · Terms · Locations · Language
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#363636', fontSize: '0.68rem' }}>
              © 2026 CLEANTALK
            </Typography>
          </Box>
        </Box>
      </Box>
    </Layout>
  );
};

export default Home;