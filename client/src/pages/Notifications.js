import React, { useState, useEffect } from 'react';
import { Box, Avatar, Typography, IconButton, CircularProgress, Button } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { notificationAPI, userAPI } from '../services/api';

const getText = (n) => {
  switch (n.type) {
    case 'like': return 'liked your photo.';
    case 'comment': return `commented: ${n.message || n.content || ''}`;
    case 'follow': return 'started following you.';
    case 'follow_request': return 'sent you a follow request.';
    case 'follow_accepted': return 'accepted your follow request.';
    case 'mention': return `mentioned you: ${n.message || n.content || ''}`;
    default: return 'interacted with your content.';
  }
};

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [handledRequests, setHandledRequests] = useState({});
  const [followRequestMap, setFollowRequestMap] = useState({});
  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

  useEffect(() => { load(); markRead(); loadFollowRequests(); }, []);

  const load = async () => {
    try { const r = await notificationAPI.getNotifications(); setNotifications(r.data.notifications || []); }
    catch (e) { setNotifications([]); } finally { setLoading(false); }
  };
  const markRead = async () => { try { await notificationAPI.markAllAsRead(); } catch (e) {} };

  // Load pending follow requests to get the actual follower row IDs
  const loadFollowRequests = async () => {
    try {
      const r = await userAPI.getFollowRequests();
      const requests = r.data.requests || [];
      // Map sender user_id -> followers table row id
      const map = {};
      requests.forEach(req => { map[req.user_id] = req.id; });
      setFollowRequestMap(map);
    } catch (e) { console.error('Load follow requests error:', e); }
  };

  const handleAccept = async (notification) => {
    // Get the followers table row ID from the map using sender_id
    const requestId = followRequestMap[notification.sender_id];
    if (!requestId) {
      alert('Follow request may have already been handled or expired.');
      return;
    }
    setActionLoading(prev => ({ ...prev, [notification.id]: 'accepting' }));
    try {
      await userAPI.acceptFollowRequest(requestId);
      setHandledRequests(prev => ({ ...prev, [notification.id]: 'accepted' }));
      // Remove from map since it's handled
      setFollowRequestMap(prev => { const copy = { ...prev }; delete copy[notification.sender_id]; return copy; });
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to accept request');
    } finally { setActionLoading(prev => ({ ...prev, [notification.id]: null })); }
  };

  const handleReject = async (notification) => {
    const requestId = followRequestMap[notification.sender_id];
    if (!requestId) {
      alert('Follow request may have already been handled or expired.');
      return;
    }
    setActionLoading(prev => ({ ...prev, [notification.id]: 'rejecting' }));
    try {
      await userAPI.rejectFollowRequest(requestId);
      setHandledRequests(prev => ({ ...prev, [notification.id]: 'rejected' }));
      setFollowRequestMap(prev => { const copy = { ...prev }; delete copy[notification.sender_id]; return copy; });
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to decline request');
    } finally { setActionLoading(prev => ({ ...prev, [notification.id]: null })); }
  };

  const handleDelete = async (id) => {
    try { await notificationAPI.deleteNotification(id); setNotifications(notifications.filter(n => n.id !== id)); } catch (e) {}
  };

  const handleClick = (n) => {
    if (n.type === 'follow' || n.type === 'follow_accepted') navigate(`/${n.sender_username}`);
    else if (n.post_id) navigate(`/post/${n.post_id}`);
  };

  if (loading) return <Layout><Box display="flex" justifyContent="center" py={8}><CircularProgress sx={{ color: '#A8A8A8' }} /></Box></Layout>;

  return (
    <Layout>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Notifications</Typography>

        {notifications.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Typography sx={{ color: '#A8A8A8' }}>No notifications yet</Typography>
          </Box>
        ) : (
          notifications.map(n => {
            const hasPendingRequest = n.type === 'follow_request' && followRequestMap[n.sender_id] && !handledRequests[n.id];
            return (
              <Box key={n.id}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, px: 1, borderRadius: 1,
                  bgcolor: n.is_read ? 'transparent' : 'rgba(255,255,255,0.03)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}>
                <Avatar
                  src={n.sender_profile_picture ? (n.sender_profile_picture.startsWith('http') ? n.sender_profile_picture : `${API_URL}${n.sender_profile_picture}`) : ''}
                  onClick={() => navigate(`/${n.sender_username}`)}
                  sx={{ width: 44, height: 44, cursor: 'pointer', flexShrink: 0 }}>
                  {n.sender_username?.[0]?.toUpperCase()}
                </Avatar>

                <Box flex={1} minWidth={0} onClick={() => n.type !== 'follow_request' && handleClick(n)}
                  sx={{ cursor: n.type !== 'follow_request' ? 'pointer' : 'default' }}>
                  <Typography variant="body2">
                    <Typography component="span" sx={{ fontWeight: 600, cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/${n.sender_username}`); }}>
                      {n.sender_username}
                    </Typography>
                    {' '}{getText(n)}{' '}
                    <Typography component="span" sx={{ color: '#A8A8A8' }}>
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: false })}
                    </Typography>
                  </Typography>

                  {/* Status after handling */}
                  {handledRequests[n.id] === 'accepted' && (
                    <Typography variant="caption" sx={{ color: '#4ade80', mt: 0.3, display: 'block' }}>
                      ✓ Follow request accepted
                    </Typography>
                  )}
                  {handledRequests[n.id] === 'rejected' && (
                    <Typography variant="caption" sx={{ color: '#A8A8A8', mt: 0.3, display: 'block' }}>
                      Follow request declined
                    </Typography>
                  )}
                </Box>

                {/* Accept/Decline buttons for pending follow requests */}
                {hasPendingRequest && (
                  <Box display="flex" gap={1} flexShrink={0}>
                    <Button size="small" variant="contained"
                      onClick={(e) => { e.stopPropagation(); handleAccept(n); }}
                      disabled={!!actionLoading[n.id]}
                      sx={{ bgcolor: '#0095F6', fontWeight: 600, fontSize: '0.75rem', borderRadius: 2, px: 2, py: 0.5, minWidth: 0, textTransform: 'none', '&:hover': { bgcolor: '#1877F2' } }}>
                      {actionLoading[n.id] === 'accepting' ? '...' : 'Confirm'}
                    </Button>
                    <Button size="small" variant="contained"
                      onClick={(e) => { e.stopPropagation(); handleReject(n); }}
                      disabled={!!actionLoading[n.id]}
                      sx={{ bgcolor: '#363636', color: '#F5F5F5', fontWeight: 600, fontSize: '0.75rem', borderRadius: 2, px: 2, py: 0.5, minWidth: 0, textTransform: 'none', '&:hover': { bgcolor: '#464646' } }}>
                      {actionLoading[n.id] === 'rejecting' ? '...' : 'Delete'}
                    </Button>
                  </Box>
                )}

                {/* Post thumbnail */}
                {n.post_image && (
                  <Box component="img"
                    src={n.post_image.startsWith('http') ? n.post_image : `${API_URL}${n.post_image}`}
                    alt="" sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 0.5, flexShrink: 0, cursor: 'pointer' }}
                    onClick={() => handleClick(n)} onError={(e) => { e.target.style.display = 'none'; }} />
                )}

                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                  sx={{ color: '#A8A8A8', flexShrink: 0, '&:hover': { color: '#ED4956' } }}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            );
          })
        )}
      </Box>
    </Layout>
  );
};

export default Notifications;