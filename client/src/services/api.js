import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
};

// User API
export const userAPI = {
  getUsers: () => api.get('/users'),
  searchUsers: (query) => api.get(`/users/search?q=${query}`),
  getUserProfile: (username) => api.get(`/users/${username}`),
  updateProfile: (data) => {
    // Check if data is FormData (file upload)
    if (data instanceof FormData) {
      return api.put('/users/profile', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    }
    // Regular JSON data
    return api.put('/users/profile', data);
  },
  followUser: (userId) => api.post(`/users/${userId}/follow`),
  unfollowUser: (userId) => api.delete(`/users/${userId}/unfollow`),
  getFollowers: (userId) => api.get(`/users/${userId}/followers`),
  getFollowing: (userId) => api.get(`/users/${userId}/following`),
  getSuggestions: () => api.get('/users/suggestions'),
  // Follow request methods
  getFollowRequests: () => api.get('/users/follow-requests'),
  acceptFollowRequest: (requestId) => api.post(`/users/follow-requests/${requestId}/accept`),
  rejectFollowRequest: (requestId) => api.post(`/users/follow-requests/${requestId}/reject`),
};

// Post API
export const postAPI = {
  createPost: (formData) => api.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getAllPosts: (params) => api.get('/posts', { params }),
  getFeedPosts: (params) => api.get('/posts/feed', { params }),
  getPost: (postId) => api.get(`/posts/${postId}`),
  getUserPosts: (username) => api.get(`/posts/user/${username}`),
  deletePost: (postId) => api.delete(`/posts/${postId}`),
  likePost: (postId) => api.post(`/posts/${postId}/like`),
  unlikePost: (postId) => api.delete(`/posts/${postId}/unlike`),
  addComment: (postId, content) => api.post(`/posts/${postId}/comment`, { content }),
  getComments: (postId, params) => api.get(`/posts/${postId}/comments`, { params }),
  savePost: (postId) => api.post(`/posts/${postId}/save`),
  unsavePost: (postId) => api.delete(`/posts/${postId}/unsave`),
  getSavedPosts: () => api.get('/posts/saved'),
  getLikedPosts: () => api.get('/posts/liked'),
  getCommentedPosts: () => api.get('/posts/commented'),
};

// Message API
export const messageAPI = {
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (userId, params) => api.get(`/messages/${userId}`, { params }),
  sendMessage: (data) => api.post('/messages', data),
  markAsRead: (messageId) => api.put(`/messages/${messageId}/read`),
  markAllAsRead: (userId) => api.put(`/messages/user/${userId}/read-all`),
  getUnreadCount: () => api.get('/messages/unread-count'),
};

// Notification API
export const notificationAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAllAsRead: () => api.put('/notifications/read'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
};


// Story API
export const storyAPI = {
  createStory: (formData) => api.post('/stories', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getStories: () => api.get('/stories'),
  getUserStories: (userId) => api.get(`/stories/user/${userId}`),
  deleteStory: (storyId) => api.delete(`/stories/${storyId}`),
};

export default api;