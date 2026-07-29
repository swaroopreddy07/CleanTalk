import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, Box, IconButton, Avatar, Typography, TextField, Button, Divider, CircularProgress, Alert, Snackbar, Chip } from '@mui/material';
import { Close as CloseIcon, Favorite, FavoriteBorder, BookmarkBorder, Bookmark, Delete as DeleteIcon, Shield, CheckCircle, Warning } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { postAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const PostModal = ({ open, onClose, postId, onDelete }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

  const loadPost = useCallback(async () => {
    try {
      const r = await postAPI.getPost(postId);
      setPost(r.data.post); setIsLiked(r.data.post.is_liked); setIsSaved(r.data.post.is_saved); setLikesCount(r.data.post.likes_count);
    } catch (e) {} finally { setLoading(false); }
  }, [postId]);

  const loadComments = useCallback(async () => {
    try { const r = await postAPI.getComments(postId); setComments(r.data.comments || []); } catch (e) { setComments([]); }
  }, [postId]);

  useEffect(() => { if (open && postId) { loadPost(); loadComments(); } }, [open, postId, loadPost, loadComments]);

  const handleLike = async () => {
    try {
      if (isLiked) { await postAPI.unlikePost(postId); setLikesCount(p => p - 1); }
      else { await postAPI.likePost(postId); setLikesCount(p => p + 1); }
      setIsLiked(!isLiked);
    } catch (e) {}
  };

  const handleSave = async () => {
    try { if (isSaved) await postAPI.unsavePost(postId); else await postAPI.savePost(postId); setIsSaved(!isSaved); } catch (e) {}
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      setSubmittingComment(true);
      const r = await postAPI.addComment(postId, newComment);
      const c = r.data.comment; c._pending = true;
      setComments([c, ...comments]); setNewComment('');
    } catch (e) {} finally { setSubmittingComment(false); }
  };

  useEffect(() => {
    if (!socket) return;
    const handle = (data) => {
      if (data.postId == postId) {
        if (data.status === 'blocked') {
          setComments(prev => prev.filter(c => c.id !== data.commentId));
          setSnackbarMessage('Comment blocked — hate speech detected'); setSnackbarSeverity('error'); setSnackbarOpen(true);
        } else {
          setComments(prev => prev.map(c => c.id === data.commentId ? { ...c, status: data.status, _pending: false } : c));
          if (data.status === 'approved') { setSnackbarMessage('Comment posted'); setSnackbarSeverity('success'); setSnackbarOpen(true); }
        }
      }
    };
    socket.on('moderation:result', handle); socket.on('comment:status-update', handle);
    return () => { socket.off('moderation:result', handle); socket.off('comment:status-update', handle); };
  }, [socket, postId]);

  if (loading) return <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth><Box display="flex" justifyContent="center" p={6}><CircularProgress sx={{ color: '#A8A8A8' }} /></Box></Dialog>;
  if (!post) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { bgcolor: '#000', border: '1px solid #363636', borderRadius: 1, overflow: 'hidden' } }}>
      <Box display="flex" sx={{ height: { xs: 'auto', md: '80vh' }, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Image */}
        <Box flex={1} sx={{ bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: { xs: 300, md: 'auto' } }}>
          <img src={post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`) : ''} alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
        </Box>

        {/* Details */}
        <Box width={{ xs: '100%', md: 380 }} display="flex" flexDirection="column" borderLeft="1px solid #262626">
          {/* Header */}
          <Box p={2} display="flex" alignItems="center" justifyContent="space-between" borderBottom="1px solid #262626">
            <Box display="flex" alignItems="center" gap={1.5}>
              <Avatar src={post.profile_picture ? `${API_URL}${post.profile_picture}` : ''} sx={{ width: 32, height: 32, cursor: 'pointer' }}
                onClick={() => { navigate(`/${post.username}`); onClose(); }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => { navigate(`/${post.username}`); onClose(); }}>
                {post.username}
              </Typography>
            </Box>
            <Box display="flex" gap={0.5}>
              {onDelete && user?.id === post.user_id && (
                <IconButton size="small" onClick={() => { if (window.confirm('Delete?')) { onDelete(post.id); onClose(); } }} sx={{ color: '#ED4956' }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
              <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
            </Box>
          </Box>

          {/* Comments */}
          <Box flex={1} sx={{ overflowY: 'auto' }} p={2}>
            {post.caption && (
              <Box display="flex" gap={1.5} mb={2}>
                <Avatar src={post.profile_picture ? `${API_URL}${post.profile_picture}` : ''} sx={{ width: 28, height: 28 }} />
                <Box>
                  <Typography variant="body2"><Typography component="span" sx={{ fontWeight: 600, mr: 0.5 }}>{post.username}</Typography>{post.caption}</Typography>
                  <Typography variant="caption" sx={{ color: '#A8A8A8' }}>{formatDistanceToNow(new Date(post.created_at), { addSuffix: false })}</Typography>
                </Box>
              </Box>
            )}
            {comments.filter(c => c.status !== 'blocked').map(c => (
              <Box key={c.id} display="flex" gap={1.5} mb={2} sx={{ opacity: c._pending ? 0.5 : 1 }}>
                <Avatar src={c.profile_picture ? `${API_URL}${c.profile_picture}` : ''} sx={{ width: 28, height: 28 }} />
                <Box>
                  <Typography variant="body2"><Typography component="span" sx={{ fontWeight: 600, mr: 0.5 }}>{c.username}</Typography>{c.content}</Typography>
                  <Typography variant="caption" sx={{ color: '#A8A8A8' }}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: false })}</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Divider />
          <Box p={1.5} display="flex" gap={0.5}>
            <IconButton onClick={handleLike}>{isLiked ? <Favorite sx={{ color: '#ED4956' }} /> : <FavoriteBorder />}</IconButton>
            <Box flex={1} />
            <IconButton onClick={handleSave}>{isSaved ? <Bookmark /> : <BookmarkBorder />}</IconButton>
          </Box>
          <Box px={2} pb={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{likesCount} likes</Typography>
            <Typography variant="caption" sx={{ color: '#A8A8A8' }}>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</Typography>
          </Box>
          <Divider />
          <Box p={1.5} display="flex" alignItems="center" gap={1}>
            <TextField fullWidth size="small" placeholder="Add a comment..." value={newComment}
              onChange={(e) => setNewComment(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
              disabled={submittingComment} variant="standard" InputProps={{ disableUnderline: true }}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.85rem' } }} />
            {newComment.trim() && (
              <Typography onClick={handleAddComment} sx={{ color: '#0095F6', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Post</Typography>
            )}
          </Box>
        </Box>
      </Box>
      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} variant="filled">{snackbarMessage}</Alert>
      </Snackbar>
    </Dialog>
  );
};

export default PostModal;