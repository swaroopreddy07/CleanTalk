import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardMedia,
  CardContent,
  CardActions,
  Avatar,
  IconButton,
  Typography,
  Box,
  Menu,
  MenuItem,
  Collapse,
  TextField,
  Button,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  ChatBubbleOutline,
  BookmarkBorder,
  Bookmark,
  MoreVert,
  Delete,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { postAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const PostCard = ({ post, onDelete, onUpdate }) => {
  console.log('🎨 PostCard rendering for post:', post.id, 'with image_url:', post.image_url);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [isSaved, setIsSaved] = useState(post.is_saved);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const handleLike = async () => {
    try {
      if (isLiked) {
        await postAPI.unlikePost(post.id);
        setLikesCount((prev) => Math.max(0, prev - 1));
      } else {
        await postAPI.likePost(post.id);
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
        await postAPI.unsavePost(post.id);
      } else {
        await postAPI.savePost(post.id);
      }
      setIsSaved(!isSaved);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      try {
        await postAPI.deletePost(post.id);
        if (onDelete) onDelete(post.id);
        handleMenuClose();
      } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete post');
      }
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = (e) => {
    e.stopPropagation();
    navigate(`/${post.username}`);
  };

  // Load and toggle comments
  const handleToggleComments = async () => {
    if (showComments) {
      setShowComments(false);
    } else {
      // Only load comments if we haven't already
      if (comments.length === 0) {
        await loadComments();
      }
      setShowComments(true);
    }
  };

  // Load comments from API
  const loadComments = async () => {
    try {
      setLoadingComments(true);
      const response = await postAPI.getComments(post.id);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Load comments error:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  // Add new comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmittingComment(true);
      const response = await postAPI.addComment(post.id, newComment);
      
      // Add the new comment to the list
      setComments([response.data.comment, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Add comment error:', error);
      alert(error.response?.data?.message || 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      {/* Card Header */}
      <CardHeader
        avatar={
          <Avatar
            src={post.profile_picture ? (post.profile_picture.startsWith('http') ? post.profile_picture : `${API_URL}${post.profile_picture}`) : ''}
            alt={post.username}
            onClick={handleProfileClick}
            sx={{ cursor: 'pointer' }}
          />
        }
        action={
          user?.id === post.user_id && (
            <>
              <IconButton onClick={handleMenuOpen}>
                <MoreVert />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                  <Delete sx={{ mr: 1 }} fontSize="small" />
                  Delete
                </MenuItem>
              </Menu>
            </>
          )
        }
        title={
          <Typography
            variant="subtitle2"
            fontWeight={600}
            onClick={handleProfileClick}
            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          >
            {post.username}
          </Typography>
        }
        subheader={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
      />

      {/* Card Media */}
      {post.image_url && (
        <Box sx={{ position: 'relative', width: '100%' }}>
          {console.log('🖼️ Rendering image for post:', post.id, 'URL:', post.image_url)}
          <img
            src={post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`) : ''}
            alt="Post"
            style={{
              width: '100%',
              maxHeight: '600px',
              objectFit: 'cover',
              display: 'block'
            }}
            onError={(e) => {
              console.error('❌ Post image failed to load:', post.image_url);
              console.error('❌ Full image URL attempted:', post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`) : 'No image URL');
              console.error('❌ Error event:', e);
              // Hide the broken image
              e.target.style.display = 'none';
            }}
            onLoad={() => {
              console.log('✅ Post image loaded successfully:', post.image_url);
            }}
          />
        </Box>
      )}

      {/* Card Actions */}
      <CardActions disableSpacing>
        <IconButton onClick={handleLike}>
          {isLiked ? (
            <Favorite sx={{ color: 'red' }} />
          ) : (
            <FavoriteBorder />
          )}
        </IconButton>
        <IconButton onClick={handleToggleComments}>
          <ChatBubbleOutline />
        </IconButton>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton onClick={handleSave}>
          {isSaved ? <Bookmark /> : <BookmarkBorder />}
        </IconButton>
      </CardActions>

      {/* Card Content - Likes and Caption */}
      <CardContent sx={{ pt: 0, pb: 1 }}>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          {likesCount} {likesCount === 1 ? 'like' : 'likes'}
        </Typography>
        
        {post.caption && (
          <Typography variant="body2">
            <Typography component="span" fontWeight={600} sx={{ mr: 1 }}>
              {post.username}
            </Typography>
            {post.caption}
          </Typography>
        )}

        {post.comments_count > 0 && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, cursor: 'pointer' }}
            onClick={handleToggleComments}
          >
            View all {post.comments_count} comments
          </Typography>
        )}
      </CardContent>

      {/* Comments Section */}
      <Collapse in={showComments} timeout="auto" unmountOnExit>
        <Divider />
        
        {/* Comments List */}
        <Box sx={{ p: 2, maxHeight: 300, overflowY: 'auto' }}>
          {loadingComments ? (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={30} />
            </Box>
          ) : comments.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              No comments yet
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {comments.map((comment) => (
                <Box key={comment.id} display="flex" gap={1}>
                  <Avatar
                    src={comment.profile_picture ? (comment.profile_picture.startsWith('http') ? comment.profile_picture : `${API_URL}${comment.profile_picture}`) : ''}
                    alt={comment.username}
                    sx={{ width: 32, height: 32 }}
                  />
                  <Box flex={1}>
                    <Box>
                      <Typography
                        variant="subtitle2"
                        fontWeight={600}
                        component="span"
                        sx={{ mr: 0.5 }}
                      >
                        {comment.username}
                      </Typography>
                    </Box>
                    <Typography variant="body2">
                      {comment.content}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Divider />

        {/* Comment Input */}
        <Box sx={{ p: 2 }}>
          <Box display="flex" gap={1} alignItems="flex-end">
            <Avatar
              src={user?.profile_picture ? (user.profile_picture.startsWith('http') ? user.profile_picture : `${API_URL}${user.profile_picture}`) : ''}
              alt={user?.username}
              sx={{ width: 32, height: 32 }}
            />
            <TextField
              fullWidth
              size="small"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) {
                  handleAddComment();
                }
              }}
              disabled={submittingComment}
              multiline
              maxRows={3}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim() || submittingComment}
              variant="text"
              sx={{ color: 'primary.main', fontWeight: 600 }}
            >
              {submittingComment ? <CircularProgress size={20} /> : 'Post'}
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Card>
  );
};

export default PostCard;