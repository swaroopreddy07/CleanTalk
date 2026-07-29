import React, { useState, useEffect } from 'react';
import {
  Box, Avatar, IconButton, Typography, TextField,
  CircularProgress, Alert, Snackbar, Chip, Collapse, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import {
  FavoriteBorder, ChatBubbleOutline, BookmarkBorder, Bookmark,
  MoreHoriz, Delete, Shield, CheckCircle, Warning, Flag, Favorite,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { postAPI, reportAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const REACTIONS = ['❤️', '😂', '😮', '😢', '😡'];

const PostCard = ({ post, onDelete, onUpdate }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [isSaved, setIsSaved] = useState(post.is_saved);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [userReaction, setUserReaction] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [pendingInfo, setPendingInfo] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  // Smart content warning
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningData, setWarningData] = useState(null);
  const [pendingComment, setPendingComment] = useState('');
  // Report
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDesc, setReportDesc] = useState('');

  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

  // Load initial reaction state
  useEffect(() => {
    postAPI.getReactions(post.id).then(r => {
      setUserReaction(r.data.userReaction);
      setLikesCount(r.data.totalCount || post.likes_count);
      if (r.data.userReaction) setIsLiked(true);
    }).catch(() => {});
  }, []); // eslint-disable-line

  const handleReaction = async (type) => {
    try {
      const r = await postAPI.reactToPost(post.id, type);
      setUserReaction(r.data.userReaction);
      setLikesCount(r.data.totalCount);
      setIsLiked(!!r.data.userReaction);
      setShowReactionPicker(false);
    } catch (e) {}
  };

  const handleQuickLike = () => {
    if (userReaction) {
      handleReaction(userReaction); // toggle off
    } else {
      handleReaction('❤️');
    }
  };

  const handleSave = async () => {
    try {
      if (isSaved) await postAPI.unsavePost(post.id);
      else await postAPI.savePost(post.id);
      setIsSaved(!isSaved);
    } catch (e) {}
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this post?')) {
      try { await postAPI.deletePost(post.id); if (onDelete) onDelete(post.id); setAnchorEl(null); }
      catch (e) {}
    }
  };

  const handleToggleComments = async () => {
    if (showComments) { setShowComments(false); return; }
    if (comments.length === 0) {
      try { setLoadingComments(true); const r = await postAPI.getComments(post.id); setComments(r.data.comments || []); }
      catch (e) {} finally { setLoadingComments(false); }
    }
    setShowComments(true);
  };

  // Smart Content Warning — preview before submitting
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setPendingComment(newComment.trim());
    try {
      // Preview check first
      const preview = await postAPI.previewComment(post.id, newComment.trim());
      if (!preview.data.safe) {
        // Show warning dialog
        setWarningData(preview.data);
        setWarningOpen(true);
        return;
      }
      // Safe — submit directly
      await submitComment(newComment.trim());
    } catch (e) {
      // If preview fails, submit directly
      await submitComment(newComment.trim());
    }
  };

  const submitComment = async (content) => {
    try {
      setSubmittingComment(true); setPendingInfo(null);
      const r = await postAPI.addComment(post.id, content);
      const comment = r.data.comment; comment._pending = true;
      setComments([comment, ...comments]); setNewComment('');
      setPendingInfo('Comment submitted for AI review...');
    } catch (e) {
      setPendingInfo(e.response?.data?.message || 'Failed');
      setTimeout(() => setPendingInfo(null), 5000);
    } finally { setSubmittingComment(false); }
  };

  const handlePostAnyway = async () => {
    setWarningOpen(false);
    setWarningData(null);
    await submitComment(pendingComment);
    setPendingComment('');
  };

  const handleEditComment = () => {
    setWarningOpen(false);
    setWarningData(null);
    // Keep the comment text for editing
  };

  // Report handler
  const handleReport = async () => {
    if (!reportReason) return;
    try {
      await reportAPI.createReport({
        reported_post_id: post.id,
        reported_user_id: post.user_id,
        reason: reportReason,
        description: reportDesc || null,
      });
      setReportOpen(false);
      setReportReason('');
      setReportDesc('');
      setAnchorEl(null);
      setSnackbarMessage('Report submitted. We will review it shortly.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (e) {
      setSnackbarMessage('Failed to submit report');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  useEffect(() => {
    if (!socket) return;
    const handle = (data) => {
      if (data.postId == post.id) { // eslint-disable-line
        if (data.status === 'blocked') {
          setComments(prev => prev.filter(c => c.id !== data.commentId));
          setPendingInfo(null);
          setSnackbarMessage('Comment blocked — violates community guidelines');
          setSnackbarSeverity('error'); setSnackbarOpen(true);
        } else {
          setComments(prev => prev.map(c => c.id === data.commentId ? { ...c, status: data.status, _pending: false } : c));
          setPendingInfo(null);
          if (data.status === 'approved') { setSnackbarMessage('Comment posted'); setSnackbarSeverity('success'); setSnackbarOpen(true); }
          else if (data.status === 'warned') { setSnackbarMessage('Comment posted with warning'); setSnackbarSeverity('warning'); setSnackbarOpen(true); }
        }
      }
    };
    socket.on('moderation:result', handle);
    socket.on('comment:status-update', handle);
    return () => { socket.off('moderation:result', handle); socket.off('comment:status-update', handle); };
  }, [socket, post.id]);

  const StatusBadge = ({ status, pending }) => {
    if (pending || status === 'pending') return <Chip icon={<Shield sx={{ fontSize: 11 }} />} label="Reviewing" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#262626', color: '#A8A8A8', '& .MuiChip-icon': { color: '#A8A8A8' } }} />;
    if (status === 'approved') return <Chip icon={<CheckCircle sx={{ fontSize: 11 }} />} label="Cleared" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#1a3a1a', color: '#4ade80', '& .MuiChip-icon': { color: '#4ade80' } }} />;
    if (status === 'warned') return <Chip icon={<Warning sx={{ fontSize: 11 }} />} label="Sensitive" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#3a2a1a', color: '#fbbf24', '& .MuiChip-icon': { color: '#fbbf24' } }} />;
    return null;
  };

  return (
    <Box sx={{ mb: 1, pb: 1, borderBottom: '1px solid #262626' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
        <Avatar src={post.profile_picture ? (post.profile_picture.startsWith('http') ? post.profile_picture : `${API_URL}${post.profile_picture}`) : ''}
          alt={post.username} onClick={() => navigate(`/${post.username}`)}
          sx={{ cursor: 'pointer', width: 32, height: 32 }}>
          {post.username?.[0]?.toUpperCase()}
        </Avatar>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, cursor: 'pointer', flex: 1, '&:hover': { opacity: 0.7 } }}
          onClick={() => navigate(`/${post.username}`)}>
          {post.username}
        </Typography>
        <Typography variant="caption" sx={{ color: '#A8A8A8' }}>
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: false })}
        </Typography>
        <>
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}><MoreHoriz sx={{ fontSize: 20 }} /></IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            {user?.id === post.user_id && (
              <MenuItem onClick={handleDelete} sx={{ color: '#ED4956' }}>
                <Delete sx={{ mr: 1, fontSize: 18 }} /> Delete
              </MenuItem>
            )}
            <MenuItem onClick={() => { setReportOpen(true); setAnchorEl(null); }} sx={{ color: '#F5F5F5' }}>
              <Flag sx={{ mr: 1, fontSize: 18 }} /> Report
            </MenuItem>
          </Menu>
        </>
      </Box>

      {/* Image */}
      {post.image_url && (
        <Box sx={{ borderRadius: 1, overflow: 'hidden', mx: -0.5, position: 'relative' }}>
          <img
            src={post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`}
            alt="Post" style={{ width: '100%', display: 'block' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          {/* Moderation status badge */}
          {post.moderation_status && post.moderation_status !== 'approved' && (
            <Box sx={{
              position: 'absolute', top: 8, right: 8,
              display: 'flex', alignItems: 'center', gap: 0.5,
              bgcolor: post.moderation_status === 'pending' ? 'rgba(251,191,36,0.9)'
                : post.moderation_status === 'blocked' ? 'rgba(237,73,86,0.9)'
                : 'rgba(34,197,94,0.9)',
              borderRadius: 2, px: 1, py: 0.3,
            }}>
              {post.moderation_status === 'pending' && <Shield sx={{ fontSize: 14, color: '#000' }} />}
              {post.moderation_status === 'blocked' && <Warning sx={{ fontSize: 14, color: '#fff' }} />}
              <Typography variant="caption" sx={{
                fontWeight: 700, fontSize: '0.65rem',
                color: post.moderation_status === 'pending' ? '#000' : '#fff',
              }}>
                {post.moderation_status === 'pending' ? 'Under AI Review'
                  : post.moderation_status === 'blocked' ? 'Content Blocked'
                  : post.moderation_status}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Actions + Reaction Picker */}
      <Box sx={{ position: 'relative' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5, mx: -1 }}>
          <IconButton
            onClick={handleQuickLike}
            onMouseEnter={() => setShowReactionPicker(true)}
          >
            {userReaction ? (
              userReaction === '❤️' ? <Favorite sx={{ color: '#ED4956' }} /> : <Typography sx={{ fontSize: 22 }}>{userReaction}</Typography>
            ) : <FavoriteBorder />}
          </IconButton>
          <IconButton onClick={handleToggleComments}>
            <ChatBubbleOutline />
          </IconButton>
          <Box flex={1} />
          <IconButton onClick={handleSave}>
            {isSaved ? <Bookmark sx={{ color: '#F5F5F5' }} /> : <BookmarkBorder />}
          </IconButton>
        </Box>

        {/* Reaction picker popup */}
        {showReactionPicker && (
          <Box
            onMouseLeave={() => setShowReactionPicker(false)}
            sx={{
              position: 'absolute', bottom: 44, left: 0, display: 'flex', gap: 0.5,
              bgcolor: '#262626', borderRadius: 4, px: 1, py: 0.5, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              animation: 'fadeIn 0.2s ease',
              '@keyframes fadeIn': { from: { opacity: 0, transform: 'scale(0.8)' }, to: { opacity: 1, transform: 'scale(1)' } },
              zIndex: 10,
            }}>
            {REACTIONS.map(r => (
              <Box key={r} onClick={() => handleReaction(r)}
                sx={{
                  fontSize: 24, cursor: 'pointer', p: 0.5, borderRadius: 2, transition: 'transform 0.15s',
                  bgcolor: userReaction === r ? 'rgba(255,255,255,0.1)' : 'transparent',
                  '&:hover': { transform: 'scale(1.3)', bgcolor: 'rgba(255,255,255,0.08)' },
                }}>
                {r}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Likes / Reactions */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {likesCount.toLocaleString()} {likesCount === 1 ? 'reaction' : 'reactions'}
      </Typography>

      {/* Caption */}
      {post.caption && (
        <Typography variant="body2" sx={{ color: '#F5F5F5', mb: 0.5 }}>
          <Typography component="span" sx={{ fontWeight: 600, mr: 0.5, cursor: 'pointer' }}
            onClick={() => navigate(`/${post.username}`)}>
            {post.username}
          </Typography>
          {post.caption}
        </Typography>
      )}

      {/* View comments */}
      {post.comments_count > 0 && (
        <Typography variant="body2" sx={{ color: '#A8A8A8', cursor: 'pointer', mb: 0.5 }}
          onClick={handleToggleComments}>
          View all {post.comments_count} comments
        </Typography>
      )}

      {/* Comments */}
      <Collapse in={showComments} timeout="auto" unmountOnExit>
        <Box sx={{ maxHeight: 260, overflowY: 'auto', py: 1 }}>
          {loadingComments ? (
            <Box display="flex" justifyContent="center" py={2}><CircularProgress size={20} sx={{ color: '#A8A8A8' }} /></Box>
          ) : comments.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#A8A8A8', textAlign: 'center', py: 2 }}>No comments yet</Typography>
          ) : (
            comments.filter(c => c.status !== 'blocked').map(c => (
              <Box key={c.id} sx={{ display: 'flex', gap: 1, mb: 1.5, opacity: (c._pending || c.status === 'pending') ? 0.5 : 1 }}>
                <Avatar src={c.profile_picture ? (c.profile_picture.startsWith('http') ? c.profile_picture : `${API_URL}${c.profile_picture}`) : ''}
                  alt={c.username} sx={{ width: 24, height: 24, mt: 0.3 }} />
                <Box flex={1}>
                  <Typography variant="body2">
                    <Typography component="span" sx={{ fontWeight: 600, mr: 0.5 }}>{c.username}</Typography>
                    {c.content}
                  </Typography>
                  <Box display="flex" gap={1} alignItems="center" mt={0.3}>
                    <Typography variant="caption" sx={{ color: '#A8A8A8', fontSize: '0.68rem' }}>
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: false })}
                    </Typography>
                    <StatusBadge status={c.status} pending={c._pending} />
                  </Box>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Collapse>

      {/* Add comment */}
      {pendingInfo && (
        <Alert severity="info" sx={{ mb: 1, py: 0 }} onClose={() => setPendingInfo(null)}>{pendingInfo}</Alert>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
        <TextField fullWidth size="small" placeholder="Add a comment..." value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
          disabled={submittingComment} variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.85rem', py: 0.5 } }} />
        {newComment.trim() && (
          <Typography onClick={handleAddComment}
            sx={{ color: '#0095F6', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', flexShrink: 0, '&:hover': { color: '#fff' } }}>
            {submittingComment ? '...' : 'Post'}
          </Typography>
        )}
      </Box>

      {/* ── Smart Content Warning Dialog ── */}
      <Dialog open={warningOpen} onClose={() => setWarningOpen(false)}
        PaperProps={{ sx: { bgcolor: '#1a1a1a', color: '#F5F5F5', borderRadius: 3, maxWidth: 420 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <Warning sx={{ color: '#fbbf24' }} /> Content Warning
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: '#D4D4D4' }}>
            ⚠️ This comment may be hurtful or violate community guidelines. You can edit it before posting.
          </Typography>
          <Box sx={{ bgcolor: '#262626', p: 1.5, borderRadius: 2, mb: 2, borderLeft: '3px solid #fbbf24' }}>
            <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#A8A8A8' }}>
              "{pendingComment}"
            </Typography>
          </Box>

          {/* Triggered labels */}
          {warningData?.triggered && warningData.triggered.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: '#A8A8A8', display: 'block', mb: 1, fontWeight: 600 }}>
                🔍 Flagged for:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {warningData.triggered.map((t, i) => (
                  <Chip key={i} label={`${t.label} (${(t.score * 100).toFixed(0)}%)`} size="small"
                    sx={{
                      height: 22, fontSize: '0.7rem',
                      bgcolor: t.score >= 0.7 ? 'rgba(237,73,86,0.2)' : 'rgba(251,191,36,0.2)',
                      color: t.score >= 0.7 ? '#ED4956' : '#fbbf24',
                      border: '1px solid',
                      borderColor: t.score >= 0.7 ? 'rgba(237,73,86,0.3)' : 'rgba(251,191,36,0.3)',
                    }} />
                ))}
              </Box>
            </Box>
          )}

          {/* Toxicity score bar */}
          {warningData?.toxicity_score && (
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#A8A8A8' }}>Toxicity Level</Typography>
                <Typography variant="caption" sx={{ color: warningData.toxicity_score >= 0.8 ? '#ED4956' : '#fbbf24', fontWeight: 700 }}>
                  {(warningData.toxicity_score * 100).toFixed(0)}%
                </Typography>
              </Box>
              <Box sx={{ height: 4, bgcolor: '#363636', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{
                  height: '100%', borderRadius: 2,
                  width: `${Math.min(warningData.toxicity_score * 100, 100)}%`,
                  bgcolor: warningData.toxicity_score >= 0.8 ? '#ED4956' : '#fbbf24',
                  transition: 'width 0.3s ease',
                }} />
              </Box>
            </Box>
          )}

          <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1.5, fontStyle: 'italic' }}>
            💡 Tip: If you post anyway, the comment will still go through AI moderation and may be blocked if it violates our guidelines.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleEditComment} sx={{ color: '#0095F6', textTransform: 'none' }}>Edit Comment</Button>
          <Button onClick={() => { setWarningOpen(false); setNewComment(''); setPendingComment(''); }}
            sx={{ color: '#A8A8A8', textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handlePostAnyway} variant="contained"
            sx={{ bgcolor: '#ED4956', textTransform: 'none', '&:hover': { bgcolor: '#c73843' } }}>
            Post Anyway
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Report Dialog ── */}
      <Dialog open={reportOpen} onClose={() => setReportOpen(false)}
        PaperProps={{ sx: { bgcolor: '#1a1a1a', color: '#F5F5F5', borderRadius: 3, maxWidth: 400 } }}>
        <DialogTitle>Report Post</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: '#A8A8A8' }}>Why are you reporting this?</Typography>
          {['harassment', 'spam', 'hate_speech', 'inappropriate', 'other'].map(reason => (
            <Box key={reason} onClick={() => setReportReason(reason)}
              sx={{
                p: 1.5, mb: 1, borderRadius: 2, cursor: 'pointer', border: '1px solid',
                borderColor: reportReason === reason ? '#0095F6' : '#363636',
                bgcolor: reportReason === reason ? 'rgba(0,149,246,0.1)' : '#262626',
                '&:hover': { borderColor: '#0095F6' },
              }}>
              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                {reason.replace('_', ' ')}
              </Typography>
            </Box>
          ))}
          <TextField fullWidth multiline rows={2} placeholder="Additional details (optional)"
            value={reportDesc} onChange={(e) => setReportDesc(e.target.value)}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { bgcolor: '#262626', color: '#F5F5F5', '& fieldset': { borderColor: '#363636' } } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReportOpen(false)} sx={{ color: '#A8A8A8', textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleReport} disabled={!reportReason} variant="contained"
            sx={{ bgcolor: '#ED4956', textTransform: 'none', '&:hover': { bgcolor: '#c73843' } }}>
            Submit Report
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} variant="filled" sx={{ borderRadius: 2 }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PostCard;