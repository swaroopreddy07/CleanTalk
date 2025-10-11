
// ============================================
// FILE 3: routes/posts.js
const express = require('express');
const router = express.Router();
const {
  createPost,
  getAllPosts,
  getFeedPosts,
  getPost,
  getUserPosts,
  deletePost,
  likePost,
  unlikePost,
  addComment,
  getComments,
  savePost,
  unsavePost,
  getSavedPosts,
  getLikedPosts,
  getCommentedPosts
} = require('../controllers/postController');
const protect = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

router.post('/', upload.uploadPost.single('image'), createPost);
router.get('/', getAllPosts);
router.get('/feed', getFeedPosts);
router.get('/saved', getSavedPosts);
router.get('/liked', getLikedPosts);
router.get('/commented', getCommentedPosts);
router.get('/:postId', getPost);
router.delete('/:postId', deletePost);

router.post('/:postId/like', likePost);
router.delete('/:postId/unlike', unlikePost);

router.post('/:postId/comment', addComment);
router.get('/:postId/comments', getComments);

router.post('/:postId/save', savePost);
router.delete('/:postId/unsave', unsavePost);

router.get('/user/:username', getUserPosts);

module.exports = router;
