import React, { useState, useEffect } from 'react';
import { Dialog, Box, IconButton, Typography, TextField, Button, Alert, LinearProgress } from '@mui/material';
import { Close as CloseIcon, AddPhotoAlternate, CheckCircle, Cancel, HourglassTop } from '@mui/icons-material';
import { postAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const CreatePost = ({ open, onClose, onPostCreated }) => {
  const { socket } = useSocket();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [moderationStatus, setModerationStatus] = useState(null); // null | 'reviewing' | 'approved' | 'blocked'
  const [moderationMessage, setModerationMessage] = useState('');
  const fileInputRef = React.useRef(null);

  // Listen for post moderation results
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      console.log('Post moderation result:', data);
      if (data.status === 'blocked') {
        setModerationStatus('blocked');
        setModerationMessage(data.message || 'Post rejected — contains inappropriate content');
      } else if (data.status === 'approved' || data.status === 'warned') {
        // WORST-WINS: Don't override 'blocked' with 'approved'
        setModerationStatus(prev => {
          if (prev === 'blocked') return 'blocked'; // Keep blocked
          setModerationMessage(data.message || 'Post approved ✓');
          return 'approved';
        });
      }
    };
    socket.on('post:moderation-result', handler);
    return () => socket.off('post:moderation-result', handler);
  }, [socket]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) { setError('Only image files are allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Max 5MB'); return; }
    setError(''); setImage(file);
    const reader = new FileReader(); reader.onloadend = () => setPreview(reader.result); reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!image) { setError('Select an image'); return; }
    if (!caption.trim()) { setError('Add a caption'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData(); fd.append('image', image); fd.append('caption', caption);
      await postAPI.createPost(fd);
      
      // Show "reviewing" status — keep dialog open so user sees it
      setModerationStatus('reviewing');
      setModerationMessage('Your post is being reviewed by AI...');
      setLoading(false);

      // Auto-approve after 10s if socket event doesn't arrive (fallback)
      setTimeout(() => {
        setModerationStatus(prev => {
          if (prev === 'reviewing') {
            setModerationMessage('Post approved ✓');
            return 'approved';
          }
          return prev;
        });
      }, 10000);
    } catch (e) { 
      setError(e.response?.data?.message || 'Failed');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCaption(''); setImage(null); setPreview(null); setError('');
    setModerationStatus(null); setModerationMessage('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: '1px solid #363636' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Create new post</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {preview && !moderationStatus && (
            <Typography onClick={handleSubmit} sx={{ color: '#0095F6', fontWeight: 600, cursor: 'pointer', lineHeight: '32px' }}>
              {loading ? 'Sharing...' : 'Share'}
            </Typography>
          )}
          <IconButton onClick={handleClose} size="small"><CloseIcon /></IconButton>
        </Box>
      </Box>
      <Box sx={{ p: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Moderation Status Banner */}
        {moderationStatus && (
          <Box sx={{
            mb: 2, p: 2, borderRadius: 2,
            bgcolor: moderationStatus === 'reviewing' ? 'rgba(251,191,36,0.1)'
              : moderationStatus === 'approved' ? 'rgba(34,197,94,0.1)'
              : 'rgba(237,73,86,0.1)',
            border: '1px solid',
            borderColor: moderationStatus === 'reviewing' ? 'rgba(251,191,36,0.3)'
              : moderationStatus === 'approved' ? 'rgba(34,197,94,0.3)'
              : 'rgba(237,73,86,0.3)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {moderationStatus === 'reviewing' && <HourglassTop sx={{ color: '#fbbf24', fontSize: 20, animation: 'spin 1.5s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />}
              {moderationStatus === 'approved' && <CheckCircle sx={{ color: '#22c55e', fontSize: 20 }} />}
              {moderationStatus === 'blocked' && <Cancel sx={{ color: '#ED4956', fontSize: 20 }} />}
              <Typography variant="subtitle2" sx={{
                fontWeight: 700,
                color: moderationStatus === 'reviewing' ? '#fbbf24'
                  : moderationStatus === 'approved' ? '#22c55e' : '#ED4956',
              }}>
                {moderationStatus === 'reviewing' ? 'AI Review in Progress'
                  : moderationStatus === 'approved' ? 'Post Approved' : 'Post Rejected'}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#A8A8A8' }}>
              {moderationMessage}
            </Typography>
            {moderationStatus === 'reviewing' && (
              <LinearProgress sx={{ mt: 1.5, borderRadius: 1, bgcolor: '#262626', '& .MuiLinearProgress-bar': { bgcolor: '#fbbf24' } }} />
            )}
            {moderationStatus === 'approved' && (
              <Button size="small" onClick={handleClose} sx={{ mt: 1, color: '#22c55e', textTransform: 'none' }}>
                Done
              </Button>
            )}
            {moderationStatus === 'blocked' && (
              <Button size="small" onClick={() => { setModerationStatus(null); setModerationMessage(''); }}
                sx={{ mt: 1, color: '#0095F6', textTransform: 'none' }}>
                Try with a different image
              </Button>
            )}
          </Box>
        )}

        <input ref={fileInputRef} accept="image/*" style={{ display: 'none' }} type="file" onChange={handleImageChange} disabled={loading || moderationStatus === 'reviewing'} />
        {preview ? (
          <Box sx={{ mb: 2, position: 'relative' }}>
            <img src={preview} alt="Preview" style={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
            {moderationStatus === 'reviewing' && (
              <Box sx={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Box sx={{ textAlign: 'center' }}>
                  <HourglassTop sx={{ color: '#fbbf24', fontSize: 40, animation: 'spin 1.5s linear infinite' }} />
                  <Typography variant="caption" sx={{ display: 'block', color: '#fbbf24', mt: 1 }}>
                    Scanning image...
                  </Typography>
                </Box>
              </Box>
            )}
            {moderationStatus === 'blocked' && (
              <Box sx={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                bgcolor: 'rgba(237,73,86,0.3)', borderRadius: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Cancel sx={{ color: '#ED4956', fontSize: 40 }} />
                  <Typography variant="caption" sx={{ display: 'block', color: '#ED4956', mt: 1, fontWeight: 700 }}>
                    Inappropriate Content Detected
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          <Box onClick={() => fileInputRef.current?.click()}
            sx={{ py: 8, textAlign: 'center', cursor: 'pointer', border: '1px solid #363636', borderRadius: 1, '&:hover': { bgcolor: '#121212' } }}>
            <AddPhotoAlternate sx={{ fontSize: 48, color: '#A8A8A8', mb: 1 }} />
            <Typography sx={{ color: '#F5F5F5' }}>Drag photos here</Typography>
            <Button variant="contained" size="small" sx={{ mt: 2, borderRadius: 2 }}>Select from computer</Button>
          </Box>
        )}
        <TextField fullWidth multiline rows={3} value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption..." disabled={loading || moderationStatus === 'reviewing'} variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.9rem' } }} />
      </Box>
    </Dialog>
  );
};

export default CreatePost;