import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Box,
  IconButton,
  Avatar,
  Typography,
  LinearProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBack,
  ArrowForward,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

const StoryViewer = ({ open, onClose, storyGroup, allStories }) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

  useEffect(() => {
    if (storyGroup) {
      const index = allStories.findIndex(s => s.user_id === storyGroup.user_id);
      setCurrentUserIndex(index);
      setCurrentStoryIndex(0);
    }
  }, [storyGroup, allStories]);

  useEffect(() => {
    if (!open) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [open, currentStoryIndex, currentUserIndex]);

  const handleNext = () => {
    const currentUser = allStories[currentUserIndex];
    if (currentStoryIndex < currentUser.stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
      setProgress(0);
    } else if (currentUserIndex < allStories.length - 1) {
      setCurrentUserIndex(currentUserIndex + 1);
      setCurrentStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
      setProgress(0);
    } else if (currentUserIndex > 0) {
      setCurrentUserIndex(currentUserIndex - 1);
      const prevUser = allStories[currentUserIndex - 1];
      setCurrentStoryIndex(prevUser.stories.length - 1);
      setProgress(0);
    }
  };

  if (!allStories || allStories.length === 0) return null;

  const currentUser = allStories[currentUserIndex];
  const currentStory = currentUser?.stories[currentStoryIndex];

  if (!currentStory) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'black',
          height: '90vh',
          m: 0,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Progress bars */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            gap: 0.5,
            p: 1,
            zIndex: 2,
          }}
        >
          {currentUser.stories.map((_, index) => (
            <Box key={index} sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={
                  index < currentStoryIndex
                    ? 100
                    : index === currentStoryIndex
                    ? progress
                    : 0
                }
                sx={{
                  bgcolor: 'rgba(255,255,255,0.3)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: 'white',
                  },
                }}
              />
            </Box>
          ))}
        </Box>

        {/* Header */}
        <Box
          sx={{
            position: 'absolute',
            top: 20,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            zIndex: 2,
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <Avatar
              src={currentUser.profile_picture ? (currentUser.profile_picture.startsWith('http') ? currentUser.profile_picture : `${API_URL}${currentUser.profile_picture}`) : ''}
              sx={{ width: 32, height: 32 }}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600 }}>
                {currentUser.username}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Story Image */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <img
            src={currentStory.image_url.startsWith('http') ? currentStory.image_url : `${API_URL}${currentStory.image_url}`}
            alt="Story"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
            onError={(e) => {
              console.error('Story image failed to load:', currentStory.image_url);
              e.target.style.display = 'none';
            }}
            onLoad={() => {
              console.log('Story image loaded successfully:', currentStory.image_url);
            }}
          />

          {/* Navigation */}
          <IconButton
            onClick={handlePrevious}
            sx={{
              position: 'absolute',
              left: 16,
              color: 'white',
              bgcolor: 'rgba(0,0,0,0.5)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
            }}
          >
            <ArrowBack />
          </IconButton>
          <IconButton
            onClick={handleNext}
            sx={{
              position: 'absolute',
              right: 16,
              color: 'white',
              bgcolor: 'rgba(0,0,0,0.5)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
            }}
          >
            <ArrowForward />
          </IconButton>
        </Box>
      </Box>
    </Dialog>
  );
};

export default StoryViewer;
