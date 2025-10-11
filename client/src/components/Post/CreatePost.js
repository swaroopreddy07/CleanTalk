import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon, AddPhotoAlternate } from '@mui/icons-material';
import { postAPI } from '../../services/api';

const CreatePost = ({ open, onClose, onPostCreated }) => {
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = React.useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only image files (JPEG, PNG, GIF, WebP) are allowed');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('File size must be less than 5MB');
      return;
    }

    setError('');
    setImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!image) {
      setError('Please select an image');
      return;
    }

    if (!caption.trim()) {
      setError('Please add a caption');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create FormData with correct field name
      const formData = new FormData();
      formData.append('image', image); // Must be 'image' to match multer config
      formData.append('caption', caption);

      console.log('Uploading post...');
      const response = await postAPI.createPost(formData);
      
      console.log('Post created:', response.data);
      
      if (onPostCreated) {
        onPostCreated(response.data.post);
      }
      
      handleClose();
    } catch (error) {
      console.error('Create post error:', error);
      setError(
        error.response?.data?.message || 
        error.message || 
        'Failed to create post. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCaption('');
    setImage(null);
    setPreview(null);
    setError('');
    onClose();
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Create New Post</Typography>
          <IconButton onClick={handleClose} size="small" disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <input
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            type="file"
            onChange={handleImageChange}
            disabled={loading}
          />
          <Button
            variant="outlined"
            component="span"
            startIcon={<AddPhotoAlternate />}
            fullWidth
            onClick={handleButtonClick}
            disabled={loading}
          >
            {image ? 'Change Image' : 'Select Image'}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Supported formats: JPEG, PNG, GIF, WebP (Max 5MB)
          </Typography>
        </Box>

        {preview && (
          <Box sx={{ mb: 2, textAlign: 'center', position: 'relative' }}>
            <img
              src={preview}
              alt="Preview"
              style={{ 
                maxWidth: '100%', 
                maxHeight: 400, 
                borderRadius: 8,
                objectFit: 'contain'
              }}
            />
            {image && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                {image.name} ({(image.size / 1024 / 1024).toFixed(2)}MB)
              </Typography>
            )}
          </Box>
        )}

        <TextField
          label="Caption"
          multiline
          rows={4}
          fullWidth
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption..."
          disabled={loading}
          variant="outlined"
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!image || loading || !caption.trim()}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Posting...
            </>
          ) : (
            'Post'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreatePost;