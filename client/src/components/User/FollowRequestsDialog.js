import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Button,
  Box,
  Typography,
  IconButton,
  Badge,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon, PersonAdd } from '@mui/icons-material';
import { userAPI } from '../../services/api';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

const FollowRequestsDialog = ({ open, onClose }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    if (open) {
      loadRequests();
    }
  }, [open]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getFollowRequests();
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Load follow requests error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      setProcessing({ ...processing, [requestId]: 'accepting' });
      await userAPI.acceptFollowRequest(requestId);
      setRequests(requests.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Accept follow request error:', error);
    } finally {
      setProcessing({ ...processing, [requestId]: null });
    }
  };

  const handleReject = async (requestId) => {
    try {
      setProcessing({ ...processing, [requestId]: 'rejecting' });
      await userAPI.rejectFollowRequest(requestId);
      setRequests(requests.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Reject follow request error:', error);
    } finally {
      setProcessing({ ...processing, [requestId]: null });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <PersonAdd color="primary" />
            <Typography variant="h6">Follow Requests</Typography>
            {requests.length > 0 && (
              <Badge badgeContent={requests.length} color="error" />
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : requests.length === 0 ? (
          <Box textAlign="center" py={4}>
            <PersonAdd sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No pending follow requests
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {requests.map((request) => (
              <ListItem
                key={request.id}
                sx={{
                  py: 2,
                  '&:not(:last-child)': {
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  },
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    src={request.profile_picture ? `${API_URL}${request.profile_picture}` : ''}
                    alt={request.username}
                  >
                    {request.username[0].toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="subtitle2" fontWeight={600}>
                      {request.display_name || request.username}
                    </Typography>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" color="text.secondary">
                        @{request.username}
                      </Typography>
                      {request.bio && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mt: 0.5,
                          }}
                        >
                          {request.bio}
                        </Typography>
                      )}
                    </>
                  }
                />
                <Box display="flex" gap={1} ml={2}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleAccept(request.id)}
                    disabled={processing[request.id]}
                  >
                    {processing[request.id] === 'accepting' ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      'Accept'
                    )}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleReject(request.id)}
                    disabled={processing[request.id]}
                  >
                    {processing[request.id] === 'rejecting' ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      'Reject'
                    )}
                  </Button>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FollowRequestsDialog;
