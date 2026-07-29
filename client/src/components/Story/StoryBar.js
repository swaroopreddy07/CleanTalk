import React, { useState, useEffect } from 'react';
import { Box, Avatar, Typography, IconButton } from '@mui/material';
import { Add as AddIcon, ChevronRight } from '@mui/icons-material';
import { storyAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StoryViewer from './StoryViewer';
import CreateStory from './CreateStory';

const StoryBar = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [selectedStory, setSelectedStory] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

  useEffect(() => { loadStories(); }, []);

  const loadStories = async () => {
    try {
      const response = await storyAPI.getStories();
      const allStories = response.data.stories || [];
      const ownStories = allStories.filter(s => Boolean(s.is_own));
      const otherStories = allStories.filter(s => !Boolean(s.is_own));
      const sorted = otherStories.sort((a, b) => new Date(a.stories[0]?.created_at || 0) - new Date(b.stories[0]?.created_at || 0));
      setStories([...ownStories, ...sorted]);
    } catch (error) { console.error('Load stories error:', error); }
  };

  return (
    <>
      <Box sx={{
        display: 'flex', gap: 2, py: 2, px: 1, mb: 2,
        borderRadius: 2, overflowX: 'auto', position: 'relative',
        border: '1px solid #262626',
        bgcolor: '#000',
        '&::-webkit-scrollbar': { display: 'none' },
      }}>
        {/* Your Story */}
        {!stories.some(s => Boolean(s.is_own)) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 66, cursor: 'pointer' }}
            onClick={() => setCreateOpen(true)}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={user?.profile_picture ? (user.profile_picture.startsWith('http') ? user.profile_picture : `${API_URL}${user.profile_picture}`) : ''}
                sx={{ width: 56, height: 56, border: '2px solid #363636' }}
              />
              <Box sx={{
                position: 'absolute', bottom: -2, right: -2,
                width: 20, height: 20, borderRadius: '50%',
                bgcolor: '#0095F6', border: '2px solid #000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AddIcon sx={{ fontSize: 14, color: '#fff' }} />
              </Box>
            </Box>
            <Typography variant="caption" sx={{ mt: 0.5, textAlign: 'center', color: '#A8A8A8', fontSize: '0.65rem' }}>
              Your story
            </Typography>
          </Box>
        )}

        {/* All Stories */}
        {stories.map(storyGroup => (
          <Box key={storyGroup.user_id}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 66, cursor: 'pointer' }}
            onClick={() => setSelectedStory(storyGroup)}>
            <Box sx={{ position: 'relative' }}>
              {/* Gradient ring */}
              <Box sx={{
                width: 62, height: 62, borderRadius: '50%',
                background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Box sx={{ width: 58, height: 58, borderRadius: '50%', bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Avatar
                    src={storyGroup.profile_picture ? (storyGroup.profile_picture.startsWith('http') ? storyGroup.profile_picture : `${API_URL}${storyGroup.profile_picture}`) : ''}
                    sx={{ width: 54, height: 54 }}
                  />
                </Box>
              </Box>
              {Boolean(storyGroup.is_own) && (
                <Box sx={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 20, height: 20, borderRadius: '50%',
                  bgcolor: '#0095F6', border: '2px solid #000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                  onClick={(e) => { e.stopPropagation(); setCreateOpen(true); }}>
                  <AddIcon sx={{ fontSize: 14, color: '#fff' }} />
                </Box>
              )}
            </Box>
            <Typography variant="caption" sx={{
              mt: 0.5, textAlign: 'center', maxWidth: 66,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: '#A8A8A8', fontSize: '0.65rem',
            }}>
              {Boolean(storyGroup.is_own) ? 'Your story' : (storyGroup.username || '')}
            </Typography>
          </Box>
        ))}
      </Box>

      <CreateStory open={createOpen} onClose={() => setCreateOpen(false)} onStoryCreated={() => loadStories()} />
      {selectedStory && (
        <StoryViewer open={!!selectedStory} onClose={() => setSelectedStory(null)} storyGroup={selectedStory} allStories={stories} />
      )}
    </>
  );
};

export default StoryBar;