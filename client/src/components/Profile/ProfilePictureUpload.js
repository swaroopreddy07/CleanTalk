import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Avatar,
  IconButton,
  Typography,
  CircularProgress,
} from '@mui/material';
import { PhotoCamera, Close, Delete } from '@mui/icons-material';
import { userAPI } from '../../services/api';

const ProfilePictureUpload = ({ open, onClose, currentUser, onUpdate }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('profilePicture', selectedFile);

      const response = await userAPI.updateProfile(formData);
      
      if (onUpdate) {
        onUpdate(response.data.user);
      }

      handleClose();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    try {
      setDeleting(true);
      const formData = new FormData();
      formData.append('removeProfilePicture', 'true');

      const response = await userAPI.updateProfile(formData);
      
      if (onUpdate) {
        onUpdate(response.data.user);
      }

      handleClose();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to remove profile picture');
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Change Profile Picture</Typography>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" alignItems="center" gap={3} py={2}>
          {/* Preview */}
          <Avatar
            src={preview || (currentUser?.profile_picture ? (currentUser.profile_picture.startsWith('http') ? currentUser.profile_picture : `${API_URL}${currentUser.profile_picture}`) : '')}
            alt="Profile"
            sx={{ width: 200, height: 200, border: '4px solid', borderColor: 'primary.main' }}
          />

          {/* Upload Button */}
          <input
            accept="image/*"
            style={{ display: 'none' }}
            id="profile-picture-input"
            type="file"
            onChange={handleFileSelect}
          />
          <label htmlFor="profile-picture-input">
            <Button
              variant="contained"
              component="span"
              startIcon={<PhotoCamera />}
              disabled={uploading || deleting}
            >
              Select Photo
            </Button>
          </label>

          {selectedFile && (
            <Typography variant="body2" color="text.secondary">
              Selected: {selectedFile.name}
            </Typography>
          )}

          {/* Delete Current Picture Button */}
          {currentUser?.profile_picture && !selectedFile && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={handleDelete}
              disabled={uploading || deleting}
            >
              {deleting ? 'Removing...' : 'Remove Current Picture'}
            </Button>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={uploading || deleting}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={!selectedFile || uploading || deleting}
        >
          {uploading ? <CircularProgress size={24} /> : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProfilePictureUpload;
