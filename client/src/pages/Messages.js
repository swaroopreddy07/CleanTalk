import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Grid,
  Paper,
  TextField,
  IconButton,
  Avatar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  InputAdornment,
  Badge,
  Divider,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  Send,
  Search,
  MoreVert,
  Circle,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { messageAPI, userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Messages = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState([]);
  const messagesEndRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const targetUsername = searchParams.get('user');

  useEffect(() => {
    loadConversations();
    loadUsers();
  }, []);

  useEffect(() => {
    if (targetUsername && conversations.length >= 0 && users.length > 0) {
      const existingConversation = conversations.find(
        conv => conv.username === targetUsername
      );
      
      if (existingConversation) {
        setSelectedConversation(existingConversation);
        loadMessages(existingConversation.user_id);
        setSearchParams({});
      } else {
        handleAutoStartConversation(targetUsername);
      }
    }
  }, [targetUsername, conversations, users]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.user_id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket listeners
  useEffect(() => {
    if (socket) {
      socket.on('message:receive', handleNewMessage);
      
      return () => {
        socket.off('message:receive');
      };
    }
  }, [socket, selectedConversation]);

  const handleNewMessage = (message) => {
    // If message is from selected conversation, add to messages
    if (selectedConversation && message.sender_id === selectedConversation.user_id) {
      setMessages(prev => [...prev, message]);
    }
    
    // Reload conversations to update last message
    loadConversations();
  };

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await messageAPI.getConversations();
      setConversations(response.data.data || []);
    } catch (error) {
      console.error('Load conversations error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (userId) => {
    try {
      const response = await messageAPI.getMessages(userId);
      setMessages(response.data.data || []);
      
      // Mark messages as read
      await messageAPI.markAllAsRead(userId);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await userAPI.getUsers();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Load users error:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedConversation) return;

    // Prevent users from messaging themselves
    if (selectedConversation.user_id === user.id) {
      alert('You cannot message yourself');
      return;
    }

    try {
      setSending(true);
      const response = await messageAPI.sendMessage({
        receiverId: selectedConversation.user_id,
        content: newMessage.trim(),
      });

      setMessages([...messages, response.data.data]);
      setNewMessage('');
      
      // Send via socket
      if (socket) {
        socket.emit('message:send', {
          receiverId: selectedConversation.user_id,
          message: response.data.data,
        });
      }

      // Reload conversations to update last message
      loadConversations();
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
  };


  const handleAutoStartConversation = async (username) => {
    try {
      if (username === user.username) {
        alert('You cannot message yourself');
        setSearchParams({});
        return;
      }

      let targetUser = users.find(u => u.username === username);
      
      if (!targetUser) {
        try {
          const response = await userAPI.getUserProfile(username);
          if (response.data && response.data.user) {
            targetUser = response.data.user;
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          alert('User not found');
          setSearchParams({});
          return;
        }
      }

      if (targetUser) {
        if (targetUser.id === user.id) {
          alert('You cannot message yourself');
          setSearchParams({});
          return;
        }

        setSelectedConversation({
          user_id: targetUser.id,
          username: targetUser.username,
          display_name: targetUser.display_name,
          profile_picture: targetUser.profile_picture,
          last_message: null,
          unread_count: 0,
        });
        
        setSearchParams({});
      }
    } catch (error) {
      console.error('Error auto-starting conversation:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredConversations = conversations.filter(conv =>
    conv.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <Box sx={{ height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
        <Grid container sx={{ height: '100%' }}>
          {/* Conversations List */}
          <Grid 
            item 
            xs={12} 
            md={4} 
            sx={{ 
              borderRight: '1px solid',
              borderColor: 'divider',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h5" fontWeight={700}>
                  Messages
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Paper>


            {/* Conversations List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
              {loading ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress />
                </Box>
              ) : filteredConversations.length === 0 ? (
                <Box textAlign="center" p={4}>
                  <Typography color="text.secondary">
                    No conversations yet
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {filteredConversations.map((conversation) => (
                    <React.Fragment key={conversation.user_id}>
                      <ListItem disablePadding>
                        <ListItemButton
                          selected={selectedConversation?.user_id === conversation.user_id}
                          onClick={() => handleSelectConversation(conversation)}
                          sx={{
                            py: 2,
                            '&.Mui-selected': {
                              bgcolor: 'action.selected',
                            },
                          }}
                        >
                          <ListItemAvatar>
                            <Badge
                              overlap="circular"
                              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                              badgeContent={
                                conversation.is_online ? (
                                  <Circle sx={{ fontSize: 12, color: 'success.main' }} />
                                ) : null
                              }
                            >
                              <Avatar
                                src={conversation.profile_picture ? `${API_URL}${conversation.profile_picture}` : ''}
                              >
                                {conversation.username[0].toUpperCase()}
                              </Avatar>
                            </Badge>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {conversation.username}
                                </Typography>
                                {conversation.last_message_time && (
                                  <Typography variant="caption" color="text.secondary">
                                    {formatDistanceToNow(new Date(conversation.last_message_time), {
                                      addSuffix: false,
                                    })}
                                  </Typography>
                                )}
                              </Box>
                            }
                            secondary={
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  noWrap
                                  sx={{ maxWidth: '200px' }}
                                >
                                  {conversation.last_message || 'Start a conversation'}
                                </Typography>
                                {conversation.unread_count > 0 && (
                                  <Badge
                                    badgeContent={conversation.unread_count}
                                    color="primary"
                                  />
                                )}
                              </Box>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>
          </Grid>

          {/* Chat Area */}
          <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar
                      src={selectedConversation.profile_picture ? `${API_URL}${selectedConversation.profile_picture}` : ''}
                    >
                      {selectedConversation.username[0].toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {selectedConversation.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {selectedConversation.display_name}
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton>
                    <MoreVert />
                  </IconButton>
                </Paper>

                {/* Messages Area */}
                <Box
                  sx={{
                    flexGrow: 1,
                    overflow: 'auto',
                    p: 3,
                    bgcolor: 'background.default',
                  }}
                >
                  {messages.length === 0 ? (
                    <Box textAlign="center" py={8}>
                      <Typography color="text.secondary">
                        No messages yet. Start the conversation!
                      </Typography>
                    </Box>
                  ) : (
                    messages.map((message, index) => {
                      const isOwn = message.sender_id === user.id;
                      const showAvatar = index === 0 || messages[index - 1].sender_id !== message.sender_id;

                      return (
                        <Box
                          key={message.id}
                          sx={{
                            display: 'flex',
                            justifyContent: isOwn ? 'flex-end' : 'flex-start',
                            mb: 2,
                          }}
                        >
                          {!isOwn && showAvatar && (
                            <Avatar
                              src={selectedConversation.profile_picture ? `${API_URL}${selectedConversation.profile_picture}` : ''}
                              sx={{ width: 32, height: 32, mr: 1 }}
                            >
                              {selectedConversation.username[0].toUpperCase()}
                            </Avatar>
                          )}
                          {!isOwn && !showAvatar && <Box sx={{ width: 40 }} />}
                          
                          <Box
                            sx={{
                              maxWidth: '70%',
                              bgcolor: isOwn ? 'primary.main' : 'background.paper',
                              color: isOwn ? 'white' : 'text.primary',
                              px: 2,
                              py: 1,
                              borderRadius: 2,
                              boxShadow: 1,
                            }}
                          >
                            <Typography variant="body1">{message.content}</Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                opacity: 0.7,
                                display: 'block',
                                mt: 0.5,
                              }}
                            >
                              {formatDistanceToNow(new Date(message.created_at), {
                                addSuffix: true,
                              })}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </Box>

                {/* Message Input */}
                <Paper
                  component="form"
                  onSubmit={handleSendMessage}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box display="flex" gap={1}>
                    <TextField
                      fullWidth
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sending}
                      size="small"
                      multiline
                      maxRows={4}
                    />
                    <IconButton
                      type="submit"
                      color="primary"
                      disabled={!newMessage.trim() || sending}
                    >
                      <Send />
                    </IconButton>
                  </Box>
                </Paper>
              </>
            ) : (
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                height="100%"
              >
                <Send sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h5" gutterBottom>
                  Select a conversation
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose a conversation from the sidebar to start messaging
                </Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      </Box>
    </Layout>
  );
};

export default Messages;