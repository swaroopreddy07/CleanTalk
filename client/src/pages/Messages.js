import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Grid, TextField, IconButton, Avatar, Typography, CircularProgress, InputAdornment } from '@mui/material';
import { Send, Search, Message as MsgIcon, DoneAll, Done } from '@mui/icons-material';
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
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
  const targetUsername = searchParams.get('user');

  useEffect(() => { loadConversations(); loadUsers(); }, []);
  useEffect(() => {
    if (targetUsername && conversations.length >= 0 && users.length > 0) {
      const existing = conversations.find(c => c.username === targetUsername);
      if (existing) { setSelectedConversation(existing); loadMessages(existing.user_id); setSearchParams({}); }
      else handleAutoStart(targetUsername);
    }
  }, [targetUsername, conversations, users]); // eslint-disable-line
  useEffect(() => { if (selectedConversation) loadMessages(selectedConversation.user_id); }, [selectedConversation]); // eslint-disable-line
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    const handleNewMsg = (msg) => {
      if (selectedConversation && msg.sender_id === selectedConversation.user_id) {
        setMessages(p => [...p, msg]);
        // Mark as read + notify sender
        socket.emit('message:read', { senderId: msg.sender_id, conversationUserId: user.id });
      }
      // Notify delivered
      if (msg.sender_id) {
        socket.emit('message:delivered', { senderId: msg.sender_id, messageId: msg.id });
      }
      loadConversations();
    };

    const handleTypingStart = (data) => {
      if (selectedConversation && data.userId === selectedConversation.user_id) {
        setIsTyping(true);
        setTypingUser(selectedConversation.username);
      }
    };
    const handleTypingStop = (data) => {
      if (selectedConversation && data.userId === selectedConversation.user_id) {
        setIsTyping(false);
        setTypingUser(null);
      }
    };

    const handleMessageDelivered = (data) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, is_delivered: true } : m));
    };
    const handleMessageRead = (data) => {
      if (selectedConversation && data.readBy === selectedConversation.user_id) {
        setMessages(prev => prev.map(m => m.sender_id === user.id ? { ...m, is_read: true, read_at: new Date().toISOString() } : m));
      }
    };

    socket.on('message:receive', handleNewMsg);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('message:delivered', handleMessageDelivered);
    socket.on('message:read', handleMessageRead);

    return () => {
      socket.off('message:receive', handleNewMsg);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('message:delivered', handleMessageDelivered);
      socket.off('message:read', handleMessageRead);
    };
  }, [socket, selectedConversation, user.id]); // eslint-disable-line

  const loadConversations = async () => { try { setLoading(true); const r = await messageAPI.getConversations(); setConversations(r.data.data || []); } catch (e) {} finally { setLoading(false); } };
  const loadMessages = async (uid) => {
    try {
      const r = await messageAPI.getMessages(uid);
      setMessages(r.data.data || []);
      await messageAPI.markAllAsRead(uid);
      // Notify sender their messages are read
      if (socket) socket.emit('message:read', { senderId: uid, conversationUserId: user.id });
    } catch (e) {}
  };
  const loadUsers = async () => { try { const r = await userAPI.getUsers(); setUsers(r.data.users || []); } catch (e) {} };

  const handleSend = async (e) => {
    e.preventDefault(); if (!newMessage.trim() || !selectedConversation) return;
    if (selectedConversation.user_id === user.id) return;
    try {
      setSending(true);
      const r = await messageAPI.sendMessage({ receiverId: selectedConversation.user_id, content: newMessage.trim() });
      setMessages([...messages, r.data.data]);
      setNewMessage('');
      if (socket) {
        socket.emit('message:send', { receiverId: selectedConversation.user_id, message: r.data.data });
        socket.emit('typing:stop', { receiverId: selectedConversation.user_id });
      }
      loadConversations();
    } catch (e) {} finally { setSending(false); }
  };

  // Typing indicator with debounce
  const handleTyping = useCallback((e) => {
    setNewMessage(e.target.value);
    if (socket && selectedConversation) {
      socket.emit('typing:start', { receiverId: selectedConversation.user_id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { receiverId: selectedConversation.user_id });
      }, 2000);
    }
  }, [socket, selectedConversation]);

  const handleAutoStart = async (uname) => {
    try {
      if (uname === user.username) { setSearchParams({}); return; }
      let t = users.find(u => u.username === uname);
      if (!t) { try { const r = await userAPI.getUserProfile(uname); t = r.data?.user; } catch (e) { setSearchParams({}); return; } }
      if (t && t.id !== user.id) { setSelectedConversation({ user_id: t.id, username: t.username, display_name: t.display_name, profile_picture: t.profile_picture }); setSearchParams({}); }
    } catch (e) {}
  };
  const filtered = conversations.filter(c => c.username?.toLowerCase().includes(searchQuery.toLowerCase()) || c.display_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  // Read receipt tick component
  const ReadReceipt = ({ msg }) => {
    if (msg.sender_id !== user.id) return null;
    if (msg.is_read || msg.read_at) return <DoneAll sx={{ fontSize: 14, color: '#3797F0', ml: 0.5 }} />;
    if (msg.is_delivered) return <DoneAll sx={{ fontSize: 14, color: '#A8A8A8', ml: 0.5 }} />;
    return <Done sx={{ fontSize: 14, color: '#A8A8A8', ml: 0.5 }} />;
  };

  return (
    <Layout>
      <Box sx={{ height: 'calc(100vh - 48px)', overflow: 'hidden', border: '1px solid #262626', borderRadius: 1 }}>
        <Grid container sx={{ height: '100%' }}>
          {/* Conversations */}
          <Grid item xs={12} md={4} sx={{ borderRight: '1px solid #262626', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #262626' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Messages</Typography>
              <TextField fullWidth size="small" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#A8A8A8', fontSize: 18 }} /></InputAdornment> }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#262626', '& fieldset': { border: 'none' } } }} />
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {loading ? <Box display="flex" justifyContent="center" p={4}><CircularProgress size={20} sx={{ color: '#A8A8A8' }} /></Box> :
                filtered.length === 0 ? <Box textAlign="center" p={4}><Typography sx={{ color: '#A8A8A8' }}>No conversations</Typography></Box> :
                filtered.map(c => (
                  <Box key={c.user_id} onClick={() => setSelectedConversation(c)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, cursor: 'pointer', bgcolor: selectedConversation?.user_id === c.user_id ? 'rgba(255,255,255,0.05)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    <Avatar src={c.profile_picture ? `${API_URL}${c.profile_picture}` : ''} sx={{ width: 48, height: 48 }}>{c.username?.[0]?.toUpperCase()}</Avatar>
                    <Box flex={1} minWidth={0}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{c.username}</Typography>
                      <Typography variant="caption" sx={{ color: '#A8A8A8' }} noWrap>{c.last_message || 'Start a conversation'}</Typography>
                    </Box>
                    {c.unread_count > 0 && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#0095F6' }} />}
                  </Box>
                ))
              }
            </Box>
          </Grid>

          {/* Chat */}
          <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {selectedConversation ? (
              <>
                <Box sx={{ p: 2, borderBottom: '1px solid #262626', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar src={selectedConversation.profile_picture ? `${API_URL}${selectedConversation.profile_picture}` : ''} sx={{ width: 36, height: 36 }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{selectedConversation.username}</Typography>
                    {isTyping && (
                      <Typography variant="caption" sx={{ color: '#0095F6', fontStyle: 'italic' }}>
                        typing
                        <span style={{ animation: 'blink 1.4s infinite' }}>...</span>
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                  {messages.length === 0 ? <Box textAlign="center" py={8}><Typography sx={{ color: '#A8A8A8' }}>No messages yet</Typography></Box> :
                    messages.map((m) => {
                      const own = m.sender_id === user.id;
                      return (
                        <Box key={m.id} sx={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start', mb: 1 }}>
                          <Box sx={{ maxWidth: '65%', px: 1.5, py: 0.8, borderRadius: 3, bgcolor: own ? '#3797F0' : '#262626', color: '#F5F5F5' }}>
                            <Typography variant="body2">{m.content}</Typography>
                            <Box display="flex" alignItems="center" justifyContent="flex-end">
                              <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.6rem' }}>
                                {formatDistanceToNow(new Date(m.created_at), { addSuffix: false })}
                              </Typography>
                              <ReadReceipt msg={m} />
                            </Box>
                          </Box>
                        </Box>
                      );
                    })
                  }
                  {/* Typing indicator bubble */}
                  {isTyping && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
                      <Box sx={{ px: 2, py: 1, borderRadius: 3, bgcolor: '#262626' }}>
                        <Box display="flex" gap={0.5}>
                          {[0, 1, 2].map(i => (
                            <Box key={i} sx={{
                              width: 6, height: 6, borderRadius: '50%', bgcolor: '#A8A8A8',
                              animation: `typingDot 1.4s ease-in-out ${i * 0.2}s infinite`,
                              '@keyframes typingDot': { '0%, 60%, 100%': { transform: 'translateY(0)' }, '30%': { transform: 'translateY(-6px)' } }
                            }} />
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  )}
                  <div ref={messagesEndRef} />
                </Box>
                <Box component="form" onSubmit={handleSend} sx={{ p: 1.5, borderTop: '1px solid #262626', display: 'flex', gap: 1 }}>
                  <TextField fullWidth size="small" placeholder="Message..." value={newMessage} onChange={handleTyping} disabled={sending}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4, bgcolor: '#262626', '& fieldset': { border: 'none' } } }} />
                  <IconButton type="submit" disabled={!newMessage.trim() || sending} sx={{ color: '#0095F6' }}><Send /></IconButton>
                </Box>
              </>
            ) : (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%">
                <MsgIcon sx={{ fontSize: 56, color: '#363636', mb: 2 }} />
                <Typography variant="h5" sx={{ fontWeight: 300, mb: 0.5 }}>Your messages</Typography>
                <Typography variant="body2" sx={{ color: '#A8A8A8' }}>Send private messages to a friend</Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      </Box>
    </Layout>
  );
};

export default Messages;