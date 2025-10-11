// ============================================
// FILE 2: routes/users.js
const express = require('express');
const router = express.Router();
const {
  getUsers,
  searchUsers,
  getUserProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getSuggestions,
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest
} = require('../controllers/userController');
const protect = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

router.get('/', getUsers);
router.get('/search', searchUsers);
router.get('/suggestions', getSuggestions);

// Follow request routes
router.get('/follow-requests', getFollowRequests);
router.post('/follow-requests/:requestId/accept', acceptFollowRequest);
router.post('/follow-requests/:requestId/reject', rejectFollowRequest);

router.get('/:username', getUserProfile);
router.put('/profile', upload.uploadProfile.single('profilePicture'), updateProfile);

router.post('/:userId/follow', followUser);
router.delete('/:userId/unfollow', unfollowUser);

router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);

module.exports = router;

