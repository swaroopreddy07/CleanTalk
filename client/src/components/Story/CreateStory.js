import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, AddPhotoAlternate } from '@mui/icons-material';
import { storyAPI } from '../../services/api';

const CreateStory = ({ open, onClose, onStoryCreated }) => {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      alert('Please select an image');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', image);

      const response = await storyAPI.createStory(formData);
      if (onStoryCreated) onStoryCreated(response.data.story);
      handleClose();
    } catch (error) {
      console.error('Create story error:', error);
      alert('Failed to create story');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setImage(null);
    setPreview(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Create Story</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <input
            accept="image/*"
            style={{ display: 'none' }}
            id="story-image-input"
            type="file"
            onChange={handleImageChange}
          />
          <label htmlFor="story-image-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<AddPhotoAlternate />}
              fullWidth
            >
              {image ? 'Change Image' : 'Select Image'}
            </Button>
          </label>
        </Box>

        {preview && (
          <Box sx={{ mb: 2, textAlign: 'center' }}>
            <img
              src={preview}
              alt="Preview"
              style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }}
            />
          </Box>
        )}

        <Typography variant="caption" color="text.secondary">
          Your story will be visible for 24 hours
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!image || loading}
        >
          {loading ? 'Posting...' : 'Share Story'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateStory;
