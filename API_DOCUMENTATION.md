# 🔌 SocialConnect API Documentation

Complete reference for all API endpoints in the SocialConnect platform.

## 📋 Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Authentication](#authentication-endpoints)
  - [Users](#user-endpoints)
  - [Posts](#post-endpoints)
  - [Messages](#message-endpoints)
  - [Notifications](#notification-endpoints)
  - [Stories](#story-endpoints)

---

## 🌐 Overview

### Base URL
```
http://localhost:5000/api
```

### Request Format
- **Content-Type:** `application/json` (for most endpoints)
- **Content-Type:** `multipart/form-data` (for file uploads)

### Response Format
All responses follow this structure:
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

### Pagination
Endpoints that return lists support pagination:
```
GET /api/posts?page=1&limit=20
```

**Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response includes:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## 🔐 Authentication

### How Authentication Works

1. **Register/Login** → Receive JWT token
2. **Store token** in localStorage/sessionStorage
3. **Include token** in all subsequent requests

### Token Format
```
Authorization: Bearer <your_jwt_token>
```

### Example
```javascript
// Store token after login
localStorage.setItem('token', response.data.token);

// Include in API requests
headers: {
  'Authorization': `Bearer ${localStorage.getItem('token')}`
}
```

### Token Expiration
- Tokens expire after **7 days**
- After expiration, user must login again
- 401 error indicates invalid/expired token

---

## ❌ Error Handling

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "field": "username",
    "details": "Username already exists"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | No permission for this action |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 500 | Server Error | Internal server error |

### Common Errors

**401 Unauthorized**
```json
{
  "success": false,
  "message": "No token provided"
}
```
**Solution:** Include Authorization header

**400 Bad Request**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```
**Solution:** Fix validation errors

---

## 🔑 Authentication Endpoints

### Register New User

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "display_name": "John Doe"
}
```

**Validation Rules:**
- `username`: 3-50 characters, alphanumeric + underscore, unique
- `email`: Valid email format, unique
- `password`: Minimum 6 characters
- `display_name`: Optional, max 100 characters

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "display_name": "John Doe",
    "profile_picture": "default-avatar.png",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Username already exists"
}
```

---

### Login

Authenticate and receive access token.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "SecurePass123!"
}
```

**Note:** Can use either `username` or `email` in the username field.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "display_name": "John Doe",
    "profile_picture": "profile.jpg"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

### Get Current User

Get authenticated user's information.

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "display_name": "John Doe",
    "bio": "Software developer and photographer",
    "profile_picture": "profile.jpg",
    "location": "New York, USA",
    "website": "https://johndoe.com",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

## 👤 User Endpoints

### Get User Profile

Get detailed profile information for any user.

**Endpoint:** `GET /api/users/:username`

**Parameters:**
- `username`: The username to look up

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 2,
    "username": "alice123",
    "display_name": "Alice Smith",
    "bio": "Travel enthusiast 🌍",
    "profile_picture": "alice.jpg",
    "location": "San Francisco, CA",
    "website": "https://alice.blog",
    "followers_count": 1234,
    "following_count": 567,
    "posts_count": 89,
    "is_following": false,
    "is_followed_by": false,
    "follow_status": null,
    "created_at": "2023-06-15T00:00:00Z"
  }
}
```

**Response Fields:**
- `is_following`: Does current user follow this user?
- `is_followed_by`: Does this user follow current user?
- `follow_status`: `null`, `'pending'`, `'accepted'`, or `'rejected'`

---

### Update Profile

Update current user's profile information.

**Endpoint:** `PUT /api/users/profile`

**Content-Type:** `multipart/form-data` (if uploading image)

**Request Body:**
```javascript
const formData = new FormData();
formData.append('display_name', 'John Updated');
formData.append('bio', 'New bio text');
formData.append('location', 'Los Angeles, CA');
formData.append('website', 'https://newsite.com');
formData.append('profile_picture', fileInput.files[0]); // Optional
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": 1,
    "username": "johndoe",
    "display_name": "John Updated",
    "bio": "New bio text",
    "location": "Los Angeles, CA",
    "website": "https://newsite.com",
    "profile_picture": "profile-123456.jpg"
  }
}
```

---

### Search Users

Search for users by username or display name.

**Endpoint:** `GET /api/users/search`

**Query Parameters:**
- `q`: Search query (minimum 2 characters)

**Example:** `GET /api/users/search?q=john`

**Success Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "johndoe",
      "display_name": "John Doe",
      "profile_picture": "john.jpg",
      "bio": "Software developer",
      "followers_count": 150,
      "is_following": false
    },
    {
      "id": 5,
      "username": "johnny_123",
      "display_name": "Johnny Smith",
      "profile_picture": "johnny.jpg",
      "bio": "Photographer",
      "followers_count": 89,
      "is_following": true
    }
  ]
}
```

---

### Follow User

Send a follow request to another user.

**Endpoint:** `POST /api/users/:userId/follow`

**Parameters:**
- `userId`: ID of user to follow

**Success Response (200):**
```json
{
  "success": true,
  "message": "Follow request sent",
  "status": "pending"
}
```

**For public accounts:**
```json
{
  "success": true,
  "message": "Now following user",
  "status": "accepted"
}
```

---

### Unfollow User

Unfollow a user.

**Endpoint:** `DELETE /api/users/:userId/unfollow`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Unfollowed successfully"
}
```

---

### Get Followers

Get list of users following a specific user.

**Endpoint:** `GET /api/users/:userId/followers`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Success Response (200):**
```json
{
  "success": true,
  "followers": [
    {
      "id": 2,
      "username": "alice123",
      "display_name": "Alice Smith",
      "profile_picture": "alice.jpg",
      "is_following": true,
      "followed_at": "2024-01-10T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

### Get Following

Get list of users that a specific user follows.

**Endpoint:** `GET /api/users/:userId/following`

**Success Response:** Same format as Get Followers

---

### Get Follow Requests

Get pending follow requests for current user.

**Endpoint:** `GET /api/users/follow-requests`

**Success Response (200):**
```json
{
  "success": true,
  "requests": [
    {
      "id": 5,
      "follower_id": 10,
      "username": "newuser123",
      "display_name": "New User",
      "profile_picture": "user.jpg",
      "bio": "Hello!",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### Accept Follow Request

Accept a pending follow request.

**Endpoint:** `POST /api/users/follow-requests/:requestId/accept`

**Parameters:**
- `requestId`: ID of the follow relationship

**Success Response (200):**
```json
{
  "success": true,
  "message": "Follow request accepted"
}
```

---

### Reject Follow Request

Reject a pending follow request.

**Endpoint:** `POST /api/users/follow-requests/:requestId/reject`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Follow request rejected"
}
```

---

### Get User Suggestions

Get suggested users to follow.

**Endpoint:** `GET /api/users/suggestions`

**Query Parameters:**
- `limit`: Number of suggestions (default: 10)

**Success Response (200):**
```json
{
  "success": true,
  "suggestions": [
    {
      "id": 15,
      "username": "photographer_pro",
      "display_name": "Pro Photographer",
      "profile_picture": "pro.jpg",
      "bio": "Professional photographer",
      "followers_count": 5000,
      "mutual_followers": 5
    }
  ]
}
```

---

## 📝 Post Endpoints

### Create Post

Create a new post with optional image.

**Endpoint:** `POST /api/posts`

**Content-Type:** `multipart/form-data`

**Request Body:**
```javascript
const formData = new FormData();
formData.append('caption', 'Beautiful sunset! #nature #photography');
formData.append('image', fileInput.files[0]); // Optional
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Post created successfully",
  "post": {
    "id": 42,
    "user_id": 1,
    "caption": "Beautiful sunset! #nature #photography",
    "image_url": "posts/image-1234567890.jpg",
    "hashtags": ["nature", "photography"],
    "likes_count": 0,
    "comments_count": 0,
    "created_at": "2024-01-15T16:30:00Z"
  }
}
```

---

### Get Feed Posts

Get posts from users that current user follows.

**Endpoint:** `GET /api/posts/feed`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Posts per page (default: 20)

**Success Response (200):**
```json
{
  "success": true,
  "posts": [
    {
      "id": 42,
      "user": {
        "id": 2,
        "username": "alice123",
        "display_name": "Alice Smith",
        "profile_picture": "alice.jpg"
      },
      "caption": "Beautiful sunset!",
      "image_url": "posts/sunset.jpg",
      "hashtags": ["nature", "photography"],
      "likes_count": 25,
      "comments_count": 5,
      "is_liked": false,
      "is_saved": false,
      "created_at": "2024-01-15T16:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

### Get All Posts (Explore)

Get all public posts (explore page).

**Endpoint:** `GET /api/posts`

**Query Parameters:**
- `page`, `limit`: Pagination
- `sort`: `latest` | `popular` (default: latest)

**Success Response:** Same format as Get Feed Posts

---

### Get Single Post

Get detailed information about a specific post.

**Endpoint:** `GET /api/posts/:postId`

**Success Response (200):**
```json
{
  "success": true,
  "post": {
    "id": 42,
    "user": {
      "id": 2,
      "username": "alice123",
      "display_name": "Alice Smith",
      "profile_picture": "alice.jpg"
    },
    "caption": "Beautiful sunset!",
    "image_url": "posts/sunset.jpg",
    "hashtags": ["nature", "photography"],
    "likes_count": 25,
    "comments_count": 5,
    "is_liked": false,
    "is_saved": false,
    "created_at": "2024-01-15T16:30:00Z",
    "updated_at": "2024-01-15T16:30:00Z"
  }
}
```

---

### Get User Posts

Get all posts by a specific user.

**Endpoint:** `GET /api/posts/user/:username`

**Query Parameters:**
- `page`, `limit`: Pagination

**Success Response:** Same format as Get Feed Posts

---

### Like Post

Like a post.

**Endpoint:** `POST /api/posts/:postId/like`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Post liked successfully"
}
```

---

### Unlike Post

Remove like from a post.

**Endpoint:** `DELETE /api/posts/:postId/unlike`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Post unliked successfully"
}
```

---

### Add Comment

Add a comment to a post.

**Endpoint:** `POST /api/posts/:postId/comment`

**Request Body:**
```json
{
  "content": "Great photo! Love the colors."
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Comment added successfully",
  "comment": {
    "id": 15,
    "post_id": 42,
    "user_id": 1,
    "content": "Great photo! Love the colors.",
    "created_at": "2024-01-15T17:00:00Z"
  }
}
```

---

### Get Comments

Get all comments for a post.

**Endpoint:** `GET /api/posts/:postId/comments`

**Query Parameters:**
- `page`, `limit`: Pagination
- `sort`: `latest` | `oldest` (default: latest)

**Success Response (200):**
```json
{
  "success": true,
  "comments": [
    {
      "id": 15,
      "user": {
        "id": 1,
        "username": "johndoe",
        "display_name": "John Doe",
        "profile_picture": "john.jpg"
      },
      "content": "Great photo! Love the colors.",
      "created_at": "2024-01-15T17:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

---

### Save Post

Bookmark a post for later.

**Endpoint:** `POST /api/posts/:postId/save`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Post saved successfully"
}
```

---

### Unsave Post

Remove post from saved posts.

**Endpoint:** `DELETE /api/posts/:postId/unsave`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Post unsaved successfully"
}
```

---

### Get Saved Posts

Get all posts saved by current user.

**Endpoint:** `GET /api/posts/saved`

**Query Parameters:**
- `page`, `limit`: Pagination

**Success Response:** Same format as Get Feed Posts

---

### Delete Post

Delete a post (only post owner can delete).

**Endpoint:** `DELETE /api/posts/:postId`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Post deleted successfully"
}
```

**Error Response (403):**
```json
{
  "success": false,
  "message": "You can only delete your own posts"
}
```

---

## 💬 Message Endpoints

### Get Conversations

Get list of all conversations.

**Endpoint:** `GET /api/messages/conversations`

**Success Response (200):**
```json
{
  "success": true,
  "conversations": [
    {
      "user": {
        "id": 2,
        "username": "alice123",
        "display_name": "Alice Smith",
        "profile_picture": "alice.jpg"
      },
      "last_message": {
        "id": 100,
        "content": "See you tomorrow!",
        "sender_id": 2,
        "is_read": true,
        "created_at": "2024-01-15T18:00:00Z"
      },
      "unread_count": 0
    }
  ]
}
```

---

### Get Messages

Get messages with a specific user.

**Endpoint:** `GET /api/messages/:userId`

**Query Parameters:**
- `page`, `limit`: Pagination

**Success Response (200):**
```json
{
  "success": true,
  "messages": [
    {
      "id": 99,
      "sender_id": 1,
      "receiver_id": 2,
      "content": "Hey, how are you?",
      "is_read": true,
      "created_at": "2024-01-15T17:00:00Z"
    },
    {
      "id": 100,
      "sender_id": 2,
      "receiver_id": 1,
      "content": "I'm good, thanks!",
      "is_read": true,
      "created_at": "2024-01-15T17:05:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 120
  }
}
```

---

### Send Message

Send a message to another user.

**Endpoint:** `POST /api/messages`

**Request Body:**
```json
{
  "receiver_id": 2,
  "content": "Hey! How's it going?"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "id": 101,
    "sender_id": 1,
    "receiver_id": 2,
    "content": "Hey! How's it going?",
    "is_read": false,
    "created_at": "2024-01-15T18:30:00Z"
  }
}
```

---

### Mark Message as Read

Mark a specific message as read.

**Endpoint:** `PUT /api/messages/:messageId/read`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Message marked as read"
}
```

---

### Mark All Messages as Read

Mark all messages from a user as read.

**Endpoint:** `PUT /api/messages/user/:userId/read-all`

**Success Response (200):**
```json
{
  "success": true,
  "message": "All messages marked as read"
}
```

---

### Get Unread Message Count

Get count of unread messages.

**Endpoint:** `GET /api/messages/unread-count`

**Success Response (200):**
```json
{
  "success": true,
  "count": 5
}
```

---

## 🔔 Notification Endpoints

### Get Notifications

Get all notifications for current user.

**Endpoint:** `GET /api/notifications`

**Query Parameters:**
- `page`, `limit`: Pagination
- `type`: Filter by type (optional)

**Success Response (200):**
```json
{
  "success": true,
  "notifications": [
    {
      "id": 50,
      "type": "like",
      "sender": {
        "id": 2,
        "username": "alice123",
        "display_name": "Alice Smith",
        "profile_picture": "alice.jpg"
      },
      "post_id": 42,
      "post_image": "posts/sunset.jpg",
      "message": "alice123 liked your post",
      "is_read": false,
      "created_at": "2024-01-15T19:00:00Z"
    },
    {
      "id": 49,
      "type": "follow",
      "sender": {
        "id": 3,
        "username": "bob2024",
        "display_name": "Bob Johnson",
        "profile_picture": "bob.jpg"
      },
      "post_id": null,
      "message": "bob2024 started following you",
      "is_read": true,
      "created_at": "2024-01-15T18:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

**Notification Types:**
- `like`: Someone liked your post
- `comment`: Someone commented on your post
- `follow`: Someone followed you
- `follow_request`: Someone requested to follow you
- `follow_accepted`: Your follow request was accepted
- `mention`: Someone mentioned you in a comment

---

### Get Unread Notification Count

Get count of unread notifications.

**Endpoint:** `GET /api/notifications/unread-count`

**Success Response (200):**
```json
{
  "success": true,
  "count": 8
}
```

---

### Mark Notification as Read

Mark a specific notification as read.

**Endpoint:** `PUT /api/notifications/:notificationId/read`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

### Mark All Notifications as Read

Mark all notifications as read.

**Endpoint:** `PUT /api/notifications/read`

**Success Response (200):**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

### Delete Notification

Delete a specific notification.

**Endpoint:** `DELETE /api/notifications/:notificationId`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

---

## 📖 Story Endpoints

### Create Story

Create a new story (expires in 24 hours).

**Endpoint:** `POST /api/stories`

**Content-Type:** `multipart/form-data`

**Request Body:**
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Story created successfully",
  "story": {
    "id": 20,
    "user_id": 1,
    "image_url": "stories/story-1234567890.jpg",
    "created_at": "2024-01-15T20:00:00Z",
    "expires_at": "2024-01-16T20:00:00Z"
  }
}
```

---

### Get Stories

Get stories from users that current user follows.

**Endpoint:** `GET /api/stories`

**Success Response (200):**
```json
{
  "success": true,
  "stories": [
    {
      "user": {
        "id": 2,
        "username": "alice123",
        "display_name": "Alice Smith",
        "profile_picture": "alice.jpg"
      },
      "stories": [
        {
          "id": 18,
          "image_url": "stories/story-001.jpg",
          "created_at": "2024-01-15T15:00:00Z",
          "expires_at": "2024-01-16T15:00:00Z"
        },
        {
          "id": 19,
          "image_url": "stories/story-002.jpg",
          "created_at": "2024-01-15T18:00:00Z",
          "expires_at": "2024-01-16T18:00:00Z"
        }
      ],
      "has_unseen": true
    }
  ]
}
```

---

### Get User Stories

Get all stories from a specific user.

**Endpoint:** `GET /api/stories/user/:userId`

**Success Response (200):**
```json
{
  "success": true,
  "stories": [
    {
      "id": 18,
      "user_id": 2,
      "image_url": "stories/story-001.jpg",
      "created_at": "2024-01-15T15:00:00Z",
      "expires_at": "2024-01-16T15:00:00Z"
    }
  ]
}
```

---

### Delete Story

Delete a story (only story owner can delete).

**Endpoint:** `DELETE /api/stories/:storyId`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Story deleted successfully"
}
```

---

## 🔧 Utility Endpoints

### Health Check

Check if server is running.

**Endpoint:** `GET /api/health`

**No authentication required**

**Success Response (200):**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-15T20:30:00Z",
  "uptime": 3600
}
```

---

## 📱 WebSocket Events (Real-Time)

### Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: localStorage.getItem('token')
  }
});
```

### User Join

```javascript
// Emit when user logs in
socket.emit('user:join', userId);

// Listen for user online
socket.on('user:online', (userId) => {
  console.log(`User ${userId} is online`);
});

// Listen for user offline
socket.on('user:offline', (userId) => {
  console.log(`User ${userId} is offline`);
});
```

### Messaging

```javascript
// Send message
socket.emit('message:send', {
  receiverId: 2,
  message: {
    content: "Hello!",
    timestamp: new Date()
  }
});

// Receive message
socket.on('message:receive', (message) => {
  console.log('New message:', message);
});
```

### Typing Indicators

```javascript
// Start typing
socket.emit('typing:start', { receiverId: 2 });

// Stop typing
socket.emit('typing:stop', { receiverId: 2 });

// Listen for typing
socket.on('typing:start', ({ userId }) => {
  console.log(`User ${userId} is typing...`);
});

socket.on('typing:stop', ({ userId }) => {
  console.log(`User ${userId} stopped typing`);
});
```

### Notifications

```javascript
// Receive notification
socket.on('notification:receive', (notification) => {
  console.log('New notification:', notification);
  // Show toast/alert
});
```

---

## 🎯 Rate Limiting

Currently, the API does not implement rate limiting, but in production you should:

- Limit API requests per IP/user
- Implement exponential backoff
- Add CAPTCHA for auth endpoints

**Recommended Limits:**
- Auth endpoints: 5 requests per minute
- Regular endpoints: 100 requests per minute
- File uploads: 10 requests per hour

---

## 🔐 Security Best Practices

### For API Consumers

1. **Never expose tokens** in client-side code
2. **Use HTTPS** in production
3. **Validate user input** before sending
4. **Handle errors gracefully**
5. **Implement token refresh** mechanism
6. **Store tokens securely** (httpOnly cookies in production)

### For API Developers

1. **Sanitize inputs** to prevent SQL injection
2. **Use parameterized queries**
3. **Validate file uploads** (type, size)
4. **Implement CORS** properly
5. **Hash passwords** with bcrypt
6. **Use environment variables** for secrets

---

## 📊 Example Usage (JavaScript)

### Complete Authentication Flow

```javascript
// Register
const registerUser = async (userData) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    }
  } catch (error) {
    console.error('Registration failed:', error);
  }
};

// Login
const loginUser = async (credentials) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('token', data.token);
      return data.user;
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
};

// Authenticated Request
const getFeed = async () => {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch('http://localhost:5000/api/posts/feed', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    return data.posts;
  } catch (error) {
    console.error('Failed to fetch feed:', error);
  }
};
```

---

## 📝 Postman Collection

You can import this collection into Postman for testing:

**Base URL:** `http://localhost:5000/api`

**Environment Variables:**
- `base_url`: `http://localhost:5000/api`
- `token`: `<your_jwt_token>`

---

## 🆘 Support

For issues or questions about the API:
1. Check error response messages
2. Verify authentication token
3. Check request format and required fields
4. Review this documentation
5. Check server logs for details

---

**API Version:** 1.0.0  
**Last Updated:** January 2024

