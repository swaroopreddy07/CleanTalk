import React, { useState, useEffect } from 'react';
import {
  Box,
  Avatar,
  Typography,
  Button,
  Grid,
  Tabs,
  Tab,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Paper,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Edit as EditIcon,
  GridOn as GridIcon,
  LocationOn,
  Link as LinkIcon,
  CalendarToday,
  AddPhotoAlternate,
  Message,
} from '@mui/icons-material';
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
  
  // Debug profile state changes
  useEffect(() => {
    console.log('📊 Profile state changed:', profile ? {
      id: profile.id,
      username: profile.username,
      followers_count: profile.followers_count,
      following_count: profile.following_count
    } : 'null');
  }, [profile]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [followStatus, setFollowStatus] = useState(null); // null, 'accepted', 'pending'
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [profilePictureDialogOpen, setProfilePictureDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    display_name: '',
    bio: '',
    location: '',
    website: '',
    profile_picture: null,
  });
  const [previewImage, setPreviewImage] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    console.log('🔄 Profile useEffect triggered for username:', username);
    loadProfile();
    loadPosts();
  }, [username]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading profile for username:', username);
      const response = await userAPI.getUserProfile(username);
      console.log('📊 Profile API response:', response.data.user);
      
      // Ensure we have the user data before setting state
      if (response.data && response.data.user) {
        const userData = response.data.user;
        console.log('✅ Setting profile with data:', {
          id: userData.id,
          username: userData.username,
          followers_count: userData.followers_count,
          following_count: userData.following_count
        });
        
        setProfile(userData);
        // Set follow status based on backend response
        setFollowStatus(userData.follow_status);
        setEditData({
          display_name: userData.display_name,
          bio: userData.bio || '',
          location: userData.location || '',
          website: userData.website || '',
          profile_picture: null,
        });
      } else {
        console.error('❌ No user data in API response');
        setProfile(null);
      }
    } catch (error) {
      console.error('❌ Load profile error:', error);
      console.error('Error details:', error.response?.data);
      if (error.response?.status === 404) {
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      console.log('🔍 Loading posts for username:', username);
      const response = await postAPI.getUserPosts(username);
      console.log('📝 Posts API response:', response.data);
      setPosts(response.data.posts || []);
      console.log('✅ Posts loaded:', response.data.posts?.length || 0);
      
      // Debug: Check first post details
      if (response.data.posts && response.data.posts.length > 0) {
        const firstPost = response.data.posts[0];
        console.log('📋 First post details:', {
          id: firstPost.id,
          caption: firstPost.caption,
          image_url: firstPost.image_url,
          created_at: firstPost.created_at
        });
      }
    } catch (error) {
      console.error('❌ Load posts error:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const handleFollow = async () => {
    try {
      if (followStatus === 'accepted' || followStatus === 'pending') {
        // Unfollow or cancel pending request
        await userAPI.unfollowUser(profile.id);
        setFollowStatus(null);
        if (followStatus === 'accepted') {
          setProfile({
            ...profile,
            followers_count: Math.max(0, profile.followers_count - 1),
          });
        }
      } else {
        // Send follow request
        await userAPI.followUser(profile.id);
        setFollowStatus('pending');
      }
      // Reload profile to get updated counts
      loadProfile();
    } catch (error) {
      console.error('Follow error:', error);
      alert(error.response?.data?.message || 'Error updating follow status');
    }
  };

  const handleCreatePost = () => {
    setCreatePostOpen(true);
  };

  const handleMessageUser = () => {
    // Navigate to messages with the specific user
    navigate(`/messages?user=${username}`);
  };

  const handlePostCreated = (newPost) => {
    setPosts(prevPosts => [newPost, ...prevPosts]);
    setCreatePostOpen(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditData({ ...editData, profile_picture: file });
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const handleEditSubmit = async () => {
    try {
      const formData = new FormData();
      formData.append('display_name', editData.display_name);
      formData.append('bio', editData.bio);
      formData.append('location', editData.location);
      formData.append('website', editData.website);
      if (editData.profile_picture) {
        formData.append('profilePicture', editData.profile_picture);
      }

      const response = await userAPI.updateProfile(formData);
      setProfile(response.data.user);
      updateUser(response.data.user);
      setEditOpen(false);
      setPreviewImage(null);
    } catch (error) {
      console.error('Update profile error:', error);
      alert(error.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        await postAPI.deletePost(postId);
        setPosts(posts.filter(post => post.id !== postId));
        setSelectedPost(null); // Close modal if open
        console.log('✅ Post deleted successfully');
      }
    } catch (error) {
      console.error('❌ Delete post error:', error);
      alert(error.response?.data?.message || 'Failed to delete post');
    }
  };

  const openFollowersModal = () => {
    setFollowersModalOpen(true);
  };

  const openFollowingModal = () => {
    setFollowingModalOpen(true);
  };

  if (loading) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <Box textAlign="center" py={8}>
          <Typography variant="h6">User not found</Typography>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ maxWidth: 935, mx: 'auto' }}>
        {/* Profile Header with Gradient Background */}
        <Paper
          elevation={0}
          sx={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 25%, #ec4899 50%, #06b6d4 75%, #10b981 100%)',
            backgroundSize: '400% 400%',
            animation: 'gradientShift 8s ease infinite',
            borderRadius: 4,
            p: 4,
            mb: 3,
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            '&:before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
              animation: 'shimmer 3s infinite',
            },
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box display="flex" gap={4} alignItems="flex-start">
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={profile.profile_picture ? (profile.profile_picture.startsWith('http') ? profile.profile_picture : `${API_URL}${profile.profile_picture}`) : ''}
                  alt={profile.username}
                  sx={{
                    width: 150,
                    height: 150,
                    border: '4px solid white',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                  }}
                />
                {isOwnProfile && (
                  <IconButton
                    onClick={() => setProfilePictureDialogOpen(true)}
                    sx={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                        transform: 'scale(1.1)',
                      },
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    }}
                    size="small"
                  >
                    <AddPhotoAlternate />
                  </IconButton>
                )}
              </Box>

              <Box flex={1}>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Typography variant="h4" fontWeight={700}>
                    {profile.display_name}
                  </Typography>
                  {isOwnProfile ? (
                    <>
                      <Button
                        variant="contained"
                        startIcon={<EditIcon />}
                        onClick={() => setEditOpen(true)}
                        sx={{
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                          color: 'primary.main',
                          fontWeight: 600,
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255,255,255,0.3)',
                          '&:hover': { 
                            background: 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 100%)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                          },
                        }}
                      >
                        Edit Profile
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<AddPhotoAlternate />}
                        onClick={handleCreatePost}
                        color="secondary"
                        sx={{
                          background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
                          fontWeight: 600,
                          '&:hover': { 
                            background: 'linear-gradient(135deg, #db2777 0%, #f472b6 100%)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 20px rgba(236, 72, 153, 0.3)',
                          },
                        }}
                      >
                        Create Post
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="contained"
                        onClick={handleFollow}
                        sx={{
                          background: followStatus === 'pending' ? 
                            'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' :
                            followStatus === 'accepted' ? 
                            'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)' : 
                            'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                          color: followStatus === 'pending' ? 'white' : 
                                 followStatus === 'accepted' ? 'primary.main' : 'white',
                          fontWeight: 600,
                          backdropFilter: 'blur(10px)',
                          border: followStatus === 'accepted' ? '1px solid rgba(255,255,255,0.3)' : 'none',
                          '&:hover': {
                            background: followStatus === 'pending' ? 
                              'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' :
                              followStatus === 'accepted' ? 
                              'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 100%)' : 
                              'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                          },
                        }}
                      >
                        {followStatus === 'pending' ? 'Requested' : 
                         followStatus === 'accepted' ? 'Following' : 'Follow'}
                      </Button>
                      {followStatus === 'accepted' && (
                        <Button
                          variant="contained"
                          startIcon={<Message />}
                          onClick={handleMessageUser}
                          sx={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                            color: 'primary.main',
                            fontWeight: 600,
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            '&:hover': { 
                              background: 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 100%)',
                              transform: 'translateY(-2px)',
                              boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                            },
                          }}
                        >
                          Message
                        </Button>
                      )}
                    </>
                  )}
                </Box>

                <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
                  @{profile.username}
                </Typography>

                <Box display="flex" gap={4} mb={2}>
                  <Box sx={{ cursor: 'pointer' }}>
                    <Typography variant="h6" fontWeight={700}>
                      {profile.posts_count || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Posts
                    </Typography>
                  </Box>
                  <Box
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      console.log('🔍 Opening followers modal, count:', profile.followers_count);
                      openFollowersModal();
                    }}
                  >
                    <Typography variant="h6" fontWeight={700}>
                      {profile.followers_count || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Followers
                    </Typography>
                  </Box>
                  <Box
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      console.log('🔍 Opening following modal, count:', profile.following_count);
                      openFollowingModal();
                    }}
                  >
                    <Typography variant="h6" fontWeight={700}>
                      {profile.following_count || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Following
                    </Typography>
                  </Box>
                </Box>

                {profile.bio && (
                  <Typography variant="body1" sx={{ mb: 2, opacity: 0.95 }}>
                    {profile.bio}
                  </Typography>
                )}

                <Box display="flex" flexWrap="wrap" gap={2}>
                  {profile.location && (
                    <Chip
                      icon={<LocationOn sx={{ color: 'white !important' }} />}
                      label={profile.location}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        '& .MuiChip-icon': { color: 'white' },
                      }}
                    />
                  )}
                  {profile.website && (
                    <Chip
                      icon={<LinkIcon sx={{ color: 'white !important' }} />}
                      label={profile.website}
                      component="a"
                      href={profile.website}
                      target="_blank"
                      clickable
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        '& .MuiChip-icon': { color: 'white' },
                      }}
                    />
                  )}
                  <Chip
                    icon={<CalendarToday sx={{ color: 'white !important' }} />}
                    label={`Joined ${profile.created_at ? format(new Date(profile.created_at), 'MMMM yyyy') : 'Unknown'}`}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      '& .MuiChip-icon': { color: 'white' },
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Tabs */}
        <Paper elevation={0} sx={{ mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={(e, newValue) => setTabValue(newValue)}
            centered
            sx={{
              '& .MuiTab-root': { minHeight: 60 },
            }}
          >
            <Tab icon={<GridIcon />} label="Posts" />
          </Tabs>
        </Paper>

        {/* Posts Grid */}
        {posts.length === 0 ? (
          <Paper elevation={0} sx={{ textAlign: 'center', py: 8 }}>
            <GridIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No posts yet
            </Typography>
            {isOwnProfile && (
              <Typography variant="body2" color="text.secondary">
                Share your first photo to get started
              </Typography>
            )}
          </Paper>
        ) : (
          <Grid container spacing={1}>
            {posts.map((post) => (
              <Grid item xs={4} key={post.id}>
                <Box
                  sx={{
                    position: 'relative',
                    paddingTop: '100%',
                    cursor: 'pointer',
                    borderRadius: 1,
                    overflow: 'hidden',
                    '&:hover .overlay': {
                      opacity: 1,
                    },
                  }}
                  onClick={() => setSelectedPost(post.id)}
                >
                  <Box
                    component="img"
                    src={post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`) : ''}
                    alt="Post"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      console.error('❌ Profile post image failed to load:', post.image_url);
                      console.error('❌ Full URL attempted:', post.image_url ? (post.image_url.startsWith('http') ? post.image_url : `${API_URL}${post.image_url}`) : 'No image URL');
                    }}
                    onLoad={() => {
                      console.log('✅ Profile post image loaded successfully:', post.image_url);
                    }}
                  />
                  <Box
                    className="overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      bgcolor: 'rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      opacity: 0,
                      transition: 'opacity 0.3s',
                      color: 'white',
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography fontWeight={600}>❤️</Typography>
                      <Typography fontWeight={600}>{post.likes_count}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography fontWeight={600}>💬</Typography>
                      <Typography fontWeight={600}>{post.comments_count}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Avatar
              src={previewImage || (profile.profile_picture ? (profile.profile_picture.startsWith('http') ? profile.profile_picture : `${API_URL}${profile.profile_picture}`) : '')}
              sx={{ width: 100, height: 100, mx: 'auto', mb: 2 }}
            />
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="profile-picture-input"
              type="file"
              onChange={handleImageChange}
            />
            <label htmlFor="profile-picture-input">
              <Button variant="outlined" component="span">
                Change Photo
              </Button>
            </label>
          </Box>

          <TextField
            fullWidth
            label="Display Name"
            value={editData.display_name}
            onChange={(e) =>
              setEditData({ ...editData, display_name: e.target.value })
            }
            margin="normal"
          />

          <TextField
            fullWidth
            label="Bio"
            multiline
            rows={4}
            value={editData.bio}
            onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
            margin="normal"
          />

          <TextField
            fullWidth
            label="Location"
            value={editData.location}
            onChange={(e) => setEditData({ ...editData, location: e.target.value })}
            margin="normal"
          />

          <TextField
            fullWidth
            label="Website"
            value={editData.website}
            onChange={(e) => setEditData({ ...editData, website: e.target.value })}
            margin="normal"
            placeholder="https://yourwebsite.com"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Post Dialog */}
      <CreatePost
        open={createPostOpen}
        onClose={() => setCreatePostOpen(false)}
        onPostCreated={handlePostCreated}
      />

      {/* Followers Modal */}
      <FollowersModal
        open={followersModalOpen}
        onClose={() => setFollowersModalOpen(false)}
        userId={profile.id}
      />

      {/* Following Modal */}
      <FollowingModal
        open={followingModalOpen}
        onClose={() => setFollowingModalOpen(false)}
        userId={profile.id}
      />

      {/* Profile Picture Upload Modal */}
      <ProfilePictureUpload
        open={profilePictureDialogOpen}
        onClose={() => setProfilePictureDialogOpen(false)}
        currentUser={profile}
        onUpdate={(updatedUser) => {
          setProfile(updatedUser);
          updateUser(updatedUser);
        }}
      />

      {/* Post Modal */}
      {selectedPost && (
        <PostModal
          open={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          postId={selectedPost}
          onDelete={handleDeletePost}
        />
      )}
    </Layout>
  );
};

export default Profile;