import React, { useState, useEffect } from 'react';
import { Box, Avatar, Typography, IconButton, Dialog } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { storyAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StoryViewer from './StoryViewer';
import CreateStory from './CreateStory';

const StoryBar = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [selectedStory, setSelectedStory] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      const response = await storyAPI.getStories();
      const allStories = response.data.stories || [];
      
      // Separate user's own stories from other users' stories
      const ownStories = allStories.filter(story => Boolean(story.is_own));
      const otherStories = allStories.filter(story => !Boolean(story.is_own));
      
      // Sort other stories by creation date (oldest first, newest on right)
      const sortedOtherStories = otherStories.sort((a, b) => {
        const aDate = new Date(a.stories[0]?.created_at || 0);
        const bDate = new Date(b.stories[0]?.created_at || 0);
        return aDate - bDate; // Ascending order - oldest first, newest last (right side)
      });
      
      // Combine them with own stories first, then others in chronological order
      setStories([...ownStories, ...sortedOtherStories]);
    } catch (error) {
      console.error('Load stories error:', error);
    }
  };

  const handleStoryCreated = (newStory) => {
    loadStories();
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 2,
          mb: 3,
          overflowX: 'auto',
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(0,0,0,0.2)',
            borderRadius: 4,
          },
        }}
      >
        {/* Your Story - Show only if user has no stories */}
        {!stories.some(story => Boolean(story.is_own)) && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: 80,
              cursor: 'pointer',
            }}
            onClick={() => setCreateOpen(true)}
          >
            <Box sx={{ position: 'relative' }}>
              <Avatar 
                src={user?.profile_picture ? (user.profile_picture.startsWith('http') ? user.profile_picture : `${API_URL}${user.profile_picture}`) : ''}
                sx={{ width: 56, height: 56 }} 
              />
              <IconButton
                size="small"
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  bgcolor: 'primary.main',
                  color: 'white',
                  width: 24,
                  height: 24,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="caption" sx={{ mt: 0.5, textAlign: 'center' }}>
              Your story
            </Typography>
          </Box>
        )}

        {/* All Stories */}
        {stories.map((storyGroup) => (
          <Box
            key={storyGroup.user_id}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: 80,
              cursor: 'pointer',
            }}
            onClick={() => setSelectedStory(storyGroup)}
          >
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={storyGroup.profile_picture ? (storyGroup.profile_picture.startsWith('http') ? storyGroup.profile_picture : `${API_URL}${storyGroup.profile_picture}`) : ''}
                sx={{
                  width: 56,
                  height: 56,
                  border: '2px solid',
                  borderColor: 'primary.main',
                }}
              />
              {/* Show add button for user's own stories */}
              {Boolean(storyGroup.is_own) && (
                <IconButton
                  size="small"
                  sx={{
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    bgcolor: 'primary.main',
                    color: 'white',
                    width: 24,
                    height: 24,
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreateOpen(true);
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <Typography
              variant="caption"
              sx={{
                mt: 0.5,
                textAlign: 'center',
                maxWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {Boolean(storyGroup.is_own) ? 'Your story' : (storyGroup.username || '')}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Create Story Dialog */}
      <CreateStory
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onStoryCreated={handleStoryCreated}
      />

      {/* Story Viewer */}
      {selectedStory && (
        <StoryViewer
          open={!!selectedStory}
          onClose={() => setSelectedStory(null)}
          storyGroup={selectedStory}
          allStories={stories}
        />
      )}
    </>
  );
};

export default StoryBar;