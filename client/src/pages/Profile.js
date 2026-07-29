import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, CircularProgress, Tabs, Tab, Avatar, Chip, IconButton, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button } from '@mui/material';
import { GridOn as GridIcon, Edit as EditIcon, AddPhotoAlternate, LocationOn, Link as LinkIcon, CalendarToday, Message } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { userAPI, postAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import CreatePost from '../components/Post/CreatePost';
import PostModal from '../components/Post/PostModal';
import FollowersModal from '../components/User/FollowersModal';
import FollowingModal from '../components/User/FollowingModal';
import ProfilePictureUpload from '../components/Profile/ProfilePictureUpload';

const Profile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [followStatus, setFollowStatus] = useState(null);
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [profilePictureDialogOpen, setProfilePictureDialogOpen] = useState(false);
  const [editData, setEditData] = useState({ display_name: '', bio: '', location: '', website: '', profile_picture: null });
  const [previewImage, setPreviewImage] = useState(null);

  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
  const isOwnProfile = currentUser?.username === username;

  useEffect(() => { loadProfile(); loadPosts(); }, [username]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const r = await userAPI.getUserProfile(username);
      if (r.data?.user) {
        setProfile(r.data.user); setFollowStatus(r.data.user.follow_status);
        setEditData({ display_name: r.data.user.display_name, bio: r.data.user.bio || '', location: r.data.user.location || '', website: r.data.user.website || '', profile_picture: null });
      } else setProfile(null);
    } catch (e) { if (e.response?.status === 404) setProfile(null); }
    finally { setLoading(false); }
  };

  const loadPosts = async () => {
    try { const r = await postAPI.getUserPosts(username); setPosts(r.data.posts || []); } catch (e) {}
  };

  const handleFollow = async () => {
    try {
      if (followStatus === 'accepted' || followStatus === 'pending') {
        await userAPI.unfollowUser(profile.id); setFollowStatus(null);
        if (followStatus === 'accepted') setProfile({ ...profile, followers_count: Math.max(0, profile.followers_count - 1) });
      } else { await userAPI.followUser(profile.id); setFollowStatus('pending'); }
      loadProfile();
    } catch (e) {}
  };

  const handleEditSubmit = async () => {
    try {
      const fd = new FormData();
      fd.append('display_name', editData.display_name); fd.append('bio', editData.bio);
      fd.append('location', editData.location); fd.append('website', editData.website);
      if (editData.profile_picture) fd.append('profilePicture', editData.profile_picture);
      const r = await userAPI.updateProfile(fd);
      setProfile(r.data.user); updateUser(r.data.user); setEditOpen(false); setPreviewImage(null);
    } catch (e) { alert(e.response?.data?.message || 'Failed'); }
  };

  const handleDeletePost = async (postId) => {
    try { if (window.confirm('Delete?')) { await postAPI.deletePost(postId); setPosts(posts.filter(p => p.id !== postId)); setSelectedPost(null); } } catch (e) {}
  };

  if (loading) return <Layout><Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh"><CircularProgress sx={{ color: '#A8A8A8' }} /></Box></Layout>;
  if (!profile) return <Layout><Box textAlign="center" py={8}><Typography>User not found</Typography></Box></Layout>;

  return (
    <Layout>
      <Box sx={{ maxWidth: 935, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', gap: { xs: 3, md: 8 }, mb: 5, px: 2, alignItems: 'flex-start' }}>
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Avatar src={profile.profile_picture ? (profile.profile_picture.startsWith('http') ? profile.profile_picture : `${API_URL}${profile.profile_picture}`) : ''}
              alt={profile.username} sx={{ width: { xs: 77, md: 150 }, height: { xs: 77, md: 150 } }} />
            {isOwnProfile && (
              <IconButton onClick={() => setProfilePictureDialogOpen(true)} size="small"
                sx={{ position: 'absolute', bottom: 0, right: 0, bgcolor: '#262626', border: '2px solid #000', width: 28, height: 28, '&:hover': { bgcolor: '#363636' } }}>
                <AddPhotoAlternate sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
              <Typography variant="h5" sx={{ fontWeight: 400 }}>{profile.username}</Typography>
              {isOwnProfile ? (
                <>
                  <Button size="small" variant="contained" onClick={() => setEditOpen(true)}
                    sx={{ bgcolor: '#363636', color: '#F5F5F5', fontWeight: 600, fontSize: '0.8rem', borderRadius: 2, '&:hover': { bgcolor: '#464646' } }}>
                    Edit profile
                  </Button>
                </>
              ) : (
                <>
                  <Button size="small" variant="contained" onClick={handleFollow}
                    sx={{
                      fontWeight: 600, fontSize: '0.8rem', borderRadius: 2,
                      ...(followStatus === 'accepted' && { bgcolor: '#363636', color: '#F5F5F5', '&:hover': { bgcolor: '#464646' } }),
                      ...(!followStatus && { bgcolor: '#0095F6', '&:hover': { bgcolor: '#1877F2' } }),
                      ...(followStatus === 'pending' && { bgcolor: '#363636', color: '#F5F5F5', '&:hover': { bgcolor: '#464646' } }),
                    }}>
                    {followStatus === 'pending' ? 'Requested' : followStatus === 'accepted' ? 'Following' : 'Follow'}
                  </Button>
                  {followStatus === 'accepted' && (
                    <Button size="small" variant="contained" onClick={() => navigate(`/messages?user=${username}`)}
                      sx={{ bgcolor: '#363636', color: '#F5F5F5', fontWeight: 600, fontSize: '0.8rem', borderRadius: 2, '&:hover': { bgcolor: '#464646' } }}>
                      Message
                    </Button>
                  )}
                </>
              )}
            </Box>
            <Box display="flex" gap={5} mb={2}>
              <Typography><strong>{profile.posts_count || 0}</strong> posts</Typography>
              <Typography sx={{ cursor: 'pointer' }} onClick={() => setFollowersModalOpen(true)}><strong>{profile.followers_count || 0}</strong> followers</Typography>
              <Typography sx={{ cursor: 'pointer' }} onClick={() => setFollowingModalOpen(true)}><strong>{profile.following_count || 0}</strong> following</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{profile.display_name}</Typography>
              {profile.bio && <Typography variant="body2" sx={{ color: '#F5F5F5', mt: 0.5 }}>{profile.bio}</Typography>}
              {profile.website && <Typography variant="body2" sx={{ color: '#0095F6', mt: 0.5 }} component="a" href={profile.website} target="_blank">{profile.website}</Typography>}
            </Box>
          </Box>
        </Box>

        {/* Tabs */}
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} centered sx={{ borderTop: '1px solid #262626' }}>
          <Tab icon={<GridIcon sx={{ fontSize: 12 }} />} label="POSTS" sx={{ fontSize: '0.7rem', letterSpacing: 1 }} />
        </Tabs>

        {/* Grid */}
        {posts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <GridIcon sx={{ fontSize: 40, color: '#A8A8A8', mb: 1 }} />
            <Typography variant="h6" sx={{ color: '#F5F5F5', fontWeight: 300 }}>No Posts Yet</Typography>
          </Box>
        ) : (
          <Grid container spacing={0.4} sx={{ mt: 0.5 }}>
            {posts.map(p => (
              <Grid item xs={4} key={p.id}>
                <Box sx={{ position: 'relative', paddingTop: '100%', cursor: 'pointer', '&:hover .ov': { opacity: 1 } }}
                  onClick={() => setSelectedPost(p.id)}>
                  <Box component="img" src={p.image_url ? (p.image_url.startsWith('http') ? p.image_url : `${API_URL}${p.image_url}`) : ''}
                    alt="" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; }} />
                  <Box className="ov" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, opacity: 0, transition: 'opacity 0.2s', color: '#fff' }}>
                    <Typography fontWeight={700}>❤️ {p.likes_count}</Typography>
                    <Typography fontWeight={700}>💬 {p.comments_count}</Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Dialogs */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, textAlign: 'center' }}>
            <Avatar src={previewImage || (profile.profile_picture ? `${API_URL}${profile.profile_picture}` : '')} sx={{ width: 80, height: 80, mx: 'auto', mb: 1 }} />
            <input accept="image/*" style={{ display: 'none' }} id="pp-input" type="file"
              onChange={(e) => { const f = e.target.files[0]; if (f) { setEditData({ ...editData, profile_picture: f }); setPreviewImage(URL.createObjectURL(f)); } }} />
            <label htmlFor="pp-input"><Button component="span" size="small" sx={{ color: '#0095F6' }}>Change photo</Button></label>
          </Box>
          <TextField fullWidth label="Name" value={editData.display_name} onChange={(e) => setEditData({ ...editData, display_name: e.target.value })} margin="dense" />
          <TextField fullWidth label="Bio" multiline rows={3} value={editData.bio} onChange={(e) => setEditData({ ...editData, bio: e.target.value })} margin="dense" />
          <TextField fullWidth label="Website" value={editData.website} onChange={(e) => setEditData({ ...editData, website: e.target.value })} margin="dense" />
        </DialogContent>
        <DialogActions><Button onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={handleEditSubmit} variant="contained">Submit</Button></DialogActions>
      </Dialog>
      <CreatePost open={createPostOpen} onClose={() => setCreatePostOpen(false)} onPostCreated={(p) => { setPosts([p, ...posts]); setCreatePostOpen(false); }} />
      <FollowersModal open={followersModalOpen} onClose={() => setFollowersModalOpen(false)} userId={profile.id} />
      <FollowingModal open={followingModalOpen} onClose={() => setFollowingModalOpen(false)} userId={profile.id} />
      <ProfilePictureUpload open={profilePictureDialogOpen} onClose={() => setProfilePictureDialogOpen(false)} currentUser={profile} onUpdate={(u) => { setProfile(u); updateUser(u); }} />
      {selectedPost && <PostModal open={!!selectedPost} onClose={() => setSelectedPost(null)} postId={selectedPost} onDelete={handleDeletePost} />}
    </Layout>
  );
};

export default Profile;