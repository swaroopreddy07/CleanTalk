import React, { useState, useEffect } from 'react';
import { Box, TextField, InputAdornment, Avatar, Button, Typography, CircularProgress } from '@mui/material';
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
  const [followStates, setFollowStates] = useState({});
  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

  useEffect(() => { if (query) handleSearch(); }, [query]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const r = await userAPI.searchUsers(query);
      const results = r.data.users || [];
      setUsers(results);
      const s = {}; results.forEach(u => { s[u.id] = u.follow_status || null; }); setFollowStates(s);
    } catch (e) { setUsers([]); } finally { setLoading(false); }
  };

  const handleFollow = async (userId, status) => {
    try {
      if (status) { await userAPI.unfollowUser(userId); setFollowStates(p => ({ ...p, [userId]: null })); }
      else { await userAPI.followUser(userId); setFollowStates(p => ({ ...p, [userId]: 'pending' })); }
    } catch (e) {}
  };

  return (
    <Layout>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <TextField fullWidth size="small" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#A8A8A8', fontSize: 20 }} /></InputAdornment> }}
          sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#262626', '& fieldset': { border: 'none' } } }} />

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} sx={{ color: '#A8A8A8' }} /></Box>
        ) : query && users.length === 0 ? (
          <Box textAlign="center" py={6}><Typography sx={{ color: '#A8A8A8' }}>No results found.</Typography></Box>
        ) : (
          users.map(u => (
            <Box key={u.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 1, cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
              <Avatar src={u.profile_picture ? (u.profile_picture.startsWith('http') ? u.profile_picture : `${API_URL}${u.profile_picture}`) : ''}
                onClick={() => navigate(`/${u.username}`)} sx={{ width: 44, height: 44, cursor: 'pointer' }}>
                {u.username?.[0]?.toUpperCase()}
              </Avatar>
              <Box flex={1} onClick={() => navigate(`/${u.username}`)}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{u.username}</Typography>
                <Typography variant="caption" sx={{ color: '#A8A8A8' }}>{u.display_name}</Typography>
              </Box>
              <Typography onClick={(e) => { e.stopPropagation(); handleFollow(u.id, followStates[u.id]); }}
                sx={{ color: followStates[u.id] ? '#A8A8A8' : '#0095F6', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                {followStates[u.id] === 'pending' ? 'Requested' : followStates[u.id] === 'accepted' ? 'Following' : 'Follow'}
              </Typography>
            </Box>
          ))
        )}
      </Box>
    </Layout>
  );
};

export default Search;