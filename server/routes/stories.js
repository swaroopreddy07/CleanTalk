const express = require('express');
const router = express.Router();
const {
  createStory,
  getStories,
  getUserStories,
  deleteStory,
  cleanupExpiredStories
} = require('../controllers/storyController');
const protect = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

router.post('/', upload.uploadStory.single('image'), createStory);
router.get('/', getStories);
router.get('/user/:userId', getUserStories);
router.delete('/:storyId', deleteStory);
router.post('/cleanup', cleanupExpiredStories);

module.exports = router;
