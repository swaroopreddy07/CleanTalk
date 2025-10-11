import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  Box,
  IconButton,
  Avatar,
  Typography,
  TextField,
  Button,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  Favorite,
  FavoriteBorder,
  BookmarkBorder,
  Bookmark,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { postAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PostModal = ({ open, onClose, postId, onDelete }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const loadPost = useCallback(async () => {
    try {
      const response = await postAPI.getPost(postId);
      setPost(response.data.post);
      setIsLiked(response.data.post.is_liked);
      setIsSaved(response.data.post.is_saved);
      setLikesCount(response.data.post.likes_count);
    } catch (error) {
      console.error('Load post error:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const loadComments = useCallback(async () => {
    try {
      const response = await postAPI.getComments(postId);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Load comments error:', error);
      setComments([]);
    }
  }, [postId]);

  useEffect(() => {
    if (open && postId) {
      loadPost();
      loadComments();
    }
  }, [open, postId, loadPost, loadComments]);

  const handleLike = async () => {
    try {
      if (isLiked) {
        await postAPI.unlikePost(postId);
        setLikesCount((prev) => prev - 1);
      } else {
        await postAPI.likePost(postId);
        setLikesCount((prev) => prev + 1);
      }
      setIsLiked(!isLiked);
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleSave = async () => {
    try {
      if (isSaved) {
        await postAPI.unsavePost(postId);
      } else {
        await postAPI.savePost(postId);
      }
      setIsSaved(!isSaved);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await postAPI.addComment(postId, newComment);
      setComments([response.data, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Add comment error:', error);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <Box display="flex" justifyContent="center" alignItems="center" p={4}>
          <CircularProgress />
        </Box>
      </Dialog>
    );
  }

  if (!post) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <Box display="flex" height="80vh">
        {/* Image Section */}
        <Box
          flex={1}
          sx={{
            bgcolor: 'black',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`) : ''}
            alt="Post"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onError={(e) => {
              console.error('❌ Post modal image failed to load:', post.image_url);
              console.error('❌ Full URL attempted:', post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`) : 'No image URL');
            }}
            onLoad={() => {
              console.log('✅ Post modal image loaded successfully:', post.image_url);
            }}
          />
        </Box>

        {/* Details Section */}
        <Box
          width={400}
          display="flex"
          flexDirection="column"
          bgcolor="background.paper"
        >
          {/* Header */}
          <Box p={2} display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar
                src={post.profile_picture ? `${API_URL}${post.profile_picture}` : ''}
                alt={post.username}
                onClick={() => {
                  navigate(`/${post.username}`);
                  onClose();
                }}
                sx={{ cursor: 'pointer' }}
              />
              <Typography
                variant="subtitle2"
                fontWeight={600}
                onClick={() => {
                  navigate(`/${post.username}`);
                  onClose();
                }}
                sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              >
                {post.username}
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              {/* Show delete button only if user owns the post and onDelete prop is provided */}
              {onDelete && user && post && user.id === post.user_id && (
                <IconButton 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
                      onDelete(post.id);
                      onClose();
                    }
                  }}
                  size="small"
                  sx={{ color: 'error.main' }}
                  title="Delete post"
                >
                  <DeleteIcon />
                </IconButton>
              )}
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          <Divider />

          {/* Comments Section */}
          <Box flex={1} sx={{ overflowY: 'auto' }} p={2}>
            {/* Caption */}
            {post.caption && (
              <Box display="flex" gap={1} mb={2}>
                <Avatar
                  src={post.profile_picture ? `${API_URL}${post.profile_picture}` : ''}
                  alt={post.username}
                  sx={{ width: 32, height: 32 }}
                />
                <Box>
                  <Typography variant="body2">
                    <Typography component="span" fontWeight={600} sx={{ mr: 1 }}>
                      {post.username}
                    </Typography>
                    {post.caption}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Comments */}
            {comments.map((comment) => (
              <Box key={comment.id} display="flex" gap={1} mb={2}>
                <Avatar
                  src={comment.profile_picture ? `${API_URL}${comment.profile_picture}` : ''}
                  alt={comment.username}
                  sx={{ width: 32, height: 32 }}
                />
                <Box>
                  <Typography variant="body2">
                    <Typography component="span" fontWeight={600} sx={{ mr: 1 }}>
                      {comment.username}
                    </Typography>
                    {comment.content}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Divider />

          {/* Actions */}
          <Box p={2}>
            <Box display="flex" gap={1} mb={1}>
              <IconButton onClick={handleLike}>
                {isLiked ? <Favorite sx={{ color: 'red' }} /> : <FavoriteBorder />}
              </IconButton>
              <Box flex={1} />
              <IconButton onClick={handleSave}>
                {isSaved ? <Bookmark /> : <BookmarkBorder />}
              </IconButton>
            </Box>

            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              {likesCount} {likesCount === 1 ? 'like' : 'likes'}
            </Typography>

            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </Typography>
          </Box>

          <Divider />

          {/* Add Comment */}
          <Box p={2} display="flex" gap={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
            />
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              variant="text"
            >
              Post
            </Button>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};

export default PostModal;