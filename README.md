# 🌐 SocialConnect - A Modern Social Media Platform

## 📋 Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Database Architecture](#database-architecture)
  - [Understanding SQL and Databases](#understanding-sql-and-databases)
  - [Database Schema Explained](#database-schema-explained)
  - [Table Relationships](#table-relationships)
  - [Important SQL Concepts](#important-sql-concepts)
- [Installation Guide](#installation-guide)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Real-Time Features](#real-time-features)
- [Security Features](#security-features)

---

## 🎯 Overview

**SocialConnect** is a full-stack social media application that enables users to connect, share posts, send messages, create stories, and interact with each other in real-time. Built with modern web technologies, it provides a seamless user experience similar to popular social platforms like Instagram and Facebook.

### What is a Social Media Platform?
A social media platform is a web application where users can:
- Create accounts and profiles
- Share content (photos, text posts)
- Follow other users
- Like and comment on posts
- Send private messages
- Get notifications about activities
- View temporary stories that disappear after 24 hours

---

## ✨ Features

### 👤 User Management
- **Registration & Authentication**: Secure user signup and login with encrypted passwords
- **Profile Management**: Customize profile with bio, location, website, and profile picture
- **Follow System**: Follow/unfollow users with follow request support
- **User Discovery**: Search for users and get suggestions for new connections

### 📝 Content Sharing
- **Posts**: Create posts with captions and images
- **Hashtags**: Tag posts with hashtags for categorization
- **Comments**: Comment on posts and engage in discussions
- **Likes**: Show appreciation with likes
- **Saved Posts**: Bookmark posts for later viewing

### 📖 Stories
- **24-Hour Stories**: Share temporary content that expires after 24 hours
- **Story Viewer**: View stories from people you follow
- **Auto-Cleanup**: Automatic removal of expired stories

### 💬 Messaging
- **Real-Time Chat**: Send and receive messages instantly
- **Typing Indicators**: See when someone is typing
- **Message Status**: Track read/unread messages
- **Conversations**: View all your conversations in one place

### 🔔 Notifications
- **Activity Alerts**: Get notified about likes, comments, follows, and mentions
- **Follow Requests**: Receive notifications for pending follow requests
- **Real-Time Updates**: Instant notification delivery using WebSockets

---

## 🛠️ Technology Stack

### Frontend (Client)
- **React 18.2.0**: JavaScript library for building user interfaces
- **Material-UI (MUI)**: Modern React component library for UI design
- **React Router DOM**: Client-side routing for navigation
- **Axios**: HTTP client for API requests
- **Socket.IO Client**: Real-time bidirectional communication
- **date-fns**: Modern JavaScript date utility library

### Backend (Server)
- **Node.js**: JavaScript runtime for server-side execution
- **Express.js**: Web application framework for Node.js
- **MySQL**: Relational database management system
- **Socket.IO**: Real-time WebSocket communication
- **JWT (jsonwebtoken)**: Secure authentication using JSON Web Tokens
- **bcryptjs**: Password hashing and encryption
- **Multer**: File upload handling middleware
- **Azure Blob Storage**: Cloud storage for images

### Development Tools
- **Nodemon**: Auto-restart server on code changes
- **dotenv**: Environment variable management
- **CORS**: Cross-Origin Resource Sharing middleware

---

## 🗄️ Database Architecture

### Understanding SQL and Databases

#### What is a Database?
A **database** is an organized collection of data stored electronically. Think of it like a digital filing cabinet where information is stored in an organized way so it can be easily accessed, managed, and updated.

#### What is SQL?
**SQL (Structured Query Language)** is the language used to communicate with databases. It's like English for databases - you use it to ask questions, add information, update records, or delete data.

#### What is MySQL?
**MySQL** is a specific type of database management system (DBMS). It's one of the most popular open-source relational databases in the world. "Relational" means data is organized in **tables** (like Excel spreadsheets) that can be connected to each other.

#### Basic SQL Concepts

**1. Tables**
A table is like a spreadsheet with rows and columns:
- **Columns** (also called fields): Define what type of information is stored (e.g., username, email, password)
- **Rows** (also called records): Each row represents one complete entry (e.g., one user)

**2. Data Types**
Each column has a specific data type that defines what kind of information it can hold:
- `INT`: Whole numbers (e.g., 1, 42, 1000)
- `VARCHAR(n)`: Text with maximum length n (e.g., "John", "hello@example.com")
- `TEXT`: Longer text content (e.g., blog posts, comments)
- `BOOLEAN`: True or false values
- `TIMESTAMP`: Date and time (e.g., "2024-01-15 14:30:00")
- `JSON`: Store structured data in JSON format

**3. Primary Key**
A **primary key** is a unique identifier for each row in a table. Think of it like a student ID number - no two students can have the same ID. In our tables, we use `id` as the primary key.

**4. Foreign Key**
A **foreign key** is a reference to a primary key in another table. It creates a relationship between two tables. For example, a post has a `user_id` foreign key that links to the `id` in the users table, showing who created the post.

**5. Indexes**
**Indexes** are like the index in a book - they help the database find information quickly. Without indexes, the database would have to scan every row to find what you're looking for.

**6. Constraints**
**Constraints** are rules that ensure data quality:
- `NOT NULL`: The field must have a value
- `UNIQUE`: No two rows can have the same value in this field
- `DEFAULT`: If no value is provided, use this default value
- `AUTO_INCREMENT`: Automatically generate the next number in sequence

---

### Database Schema Explained

Our SocialConnect database has **9 main tables**. Let's understand each one in detail:

---

#### 1️⃣ **USERS Table** - The Foundation

**Purpose**: Stores information about every user who signs up for SocialConnect.

**Structure**:
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    profile_picture VARCHAR(255) DEFAULT 'default-avatar.png',
    location VARCHAR(100),
    website VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Column Explanations**:
- **id**: Unique number assigned to each user (automatically generated)
  - `PRIMARY KEY`: This is the unique identifier
  - `AUTO_INCREMENT`: Number increases automatically (1, 2, 3, ...)
  
- **username**: User's unique username (e.g., "john_doe")
  - `VARCHAR(50)`: Can store up to 50 characters
  - `UNIQUE`: No two users can have the same username
  - `NOT NULL`: Must have a value (can't be empty)
  
- **email**: User's email address
  - `VARCHAR(100)`: Can store up to 100 characters
  - `UNIQUE`: No two users can have the same email
  - `NOT NULL`: Must have a value
  
- **password**: Encrypted password (not stored as plain text!)
  - `VARCHAR(255)`: Can store up to 255 characters (encrypted passwords are long)
  - `NOT NULL`: Every user must have a password
  
- **display_name**: Name shown on profile (can be different from username)
  - `VARCHAR(100)`: Optional field (can be empty)
  
- **bio**: User's biography/description
  - `TEXT`: Can store long text (no specific length limit)
  
- **profile_picture**: Path to user's profile picture
  - `VARCHAR(255)`: Stores the file path or URL
  - `DEFAULT 'default-avatar.png'`: If no picture uploaded, use default
  
- **location**: User's location (e.g., "New York, USA")
  - `VARCHAR(100)`: Optional field
  
- **website**: User's personal website URL
  - `VARCHAR(255)`: Optional field
  
- **is_active**: Whether the account is active or suspended
  - `BOOLEAN`: Can be only true or false
  - `DEFAULT true`: New accounts are active by default
  
- **created_at**: When the account was created
  - `TIMESTAMP`: Stores date and time
  - `DEFAULT CURRENT_TIMESTAMP`: Automatically set to current time when user registers
  
- **updated_at**: When the profile was last updated
  - `TIMESTAMP`: Stores date and time
  - `ON UPDATE CURRENT_TIMESTAMP`: Automatically updates when any field changes

**Why These Fields?**
- Authentication requires username/email and password
- Profile customization needs bio, picture, location, website
- System management needs active status and timestamps
- Each user needs a unique ID to link to their posts, comments, etc.

---

#### 2️⃣ **POSTS Table** - User Content

**Purpose**: Stores all posts created by users, including images and captions.

**Structure**:
```sql
CREATE TABLE posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    caption TEXT,
    image_url VARCHAR(255),
    hashtags JSON,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Column Explanations**:
- **id**: Unique identifier for each post
  
- **user_id**: ID of the user who created this post
  - `INT NOT NULL`: Must be a valid user ID
  - `FOREIGN KEY`: Links to the `users` table
  - `REFERENCES users(id)`: Points to the `id` column in users table
  - `ON DELETE CASCADE`: If a user is deleted, all their posts are automatically deleted
  
- **caption**: Text content of the post
  - `TEXT`: Can be long (no specific limit)
  - Optional: Posts can be image-only
  
- **image_url**: Path or URL to the post's image
  - `VARCHAR(255)`: Stores the file location
  - Optional: Posts can be text-only
  
- **hashtags**: JSON array of hashtags (e.g., ["travel", "sunset"])
  - `JSON`: Modern way to store structured data
  - Example: `["food", "cooking", "recipe"]`
  
- **likes_count**: How many users liked this post
  - `INT DEFAULT 0`: Starts at 0
  - Updated when users like/unlike the post
  - **Why?** Counting likes from another table every time would be slow
  
- **comments_count**: How many comments this post has
  - `INT DEFAULT 0`: Starts at 0
  - Updated when comments are added/removed
  
- **created_at**: When the post was created
  
- **updated_at**: When the post was last edited

**Understanding Foreign Keys**:
```
posts.user_id → users.id
     3       →    3
```
This means: Post with ID 5 has user_id = 3, which links to the user with ID 3 in the users table.

**What is CASCADE DELETE?**
If user ID 3 deletes their account:
- The `ON DELETE CASCADE` means all posts with `user_id = 3` are automatically deleted
- This maintains data integrity (no orphaned posts without owners)

---

#### 3️⃣ **COMMENTS Table** - Post Interactions

**Purpose**: Stores comments that users make on posts.

**Structure**:
```sql
CREATE TABLE comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Column Explanations**:
- **post_id**: Which post this comment belongs to
  - Links to `posts.id`
  - If the post is deleted, this comment is deleted too
  
- **user_id**: Who wrote this comment
  - Links to `users.id`
  - If the user is deleted, all their comments are deleted
  
- **content**: The actual comment text
  - `TEXT NOT NULL`: Comments must have content

**Relationship Example**:
```
User (id=5, username="Alice") 
  comments on 
Post (id=10, caption="Beautiful sunset") 
  creates
Comment (id=20, user_id=5, post_id=10, content="Amazing photo!")
```

---

#### 4️⃣ **LIKES Table** - Post Appreciation

**Purpose**: Tracks which users liked which posts.

**Structure**:
```sql
CREATE TABLE likes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_like (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Special Feature - UNIQUE Constraint**:
```sql
UNIQUE KEY unique_like (post_id, user_id)
```
This means:
- A user can like a post only ONCE
- User 5 can like post 10 once
- If they try to like it again, the database will reject it
- They must unlike first before liking again

**Example**:
```
✅ ALLOWED:
  user_id=5, post_id=10  (First like)
  
❌ NOT ALLOWED:
  user_id=5, post_id=10  (Duplicate - user already liked this post!)
  
✅ ALLOWED:
  user_id=5, post_id=11  (Different post)
  user_id=6, post_id=10  (Different user)
```

**Why No "Dislike" Boolean?**
Instead of storing `liked=true/false`, we use presence/absence:
- Like exists in table = Post is liked
- Like doesn't exist = Post is not liked
- This is more efficient and cleaner

---

#### 5️⃣ **FOLLOWERS Table** - Social Connections

**Purpose**: Manages who follows whom, with support for follow requests.

**Structure**:
```sql
CREATE TABLE followers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    follower_id INT NOT NULL,
    following_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'accepted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_follow (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Understanding the Follow Relationship**:

**follower_id**: The person doing the following (the "follower")
**following_id**: The person being followed (the "followed")

Example:
```
Alice (id=1) wants to follow Bob (id=2)
Creates entry: follower_id=1, following_id=2
Meaning: "User 1 follows User 2" or "Alice follows Bob"
```

**ENUM Data Type Explained**:
```sql
ENUM('pending', 'accepted', 'rejected')
```
- `ENUM` = Enumeration = Choose one from a fixed list
- The `status` field can ONLY be one of these three values
- `DEFAULT 'accepted'`: By default, follows are accepted immediately
- For private accounts, status starts as 'pending'

**Status Flow**:
```
User A requests to follow User B (private account)
  ↓
status = 'pending'  (waiting for approval)
  ↓
User B approves → status = 'accepted'  ✅
OR
User B rejects  → status = 'rejected'  ❌
```

**Many-to-Many Relationship**:
This table creates a "many-to-many" relationship:
- One user can follow many users
- One user can be followed by many users

Example:
```
Alice (id=1) follows:
  - Bob (id=2):   follower_id=1, following_id=2
  - Carol (id=3): follower_id=1, following_id=3
  - Dave (id=4):  follower_id=1, following_id=4

Bob (id=2) is followed by:
  - Alice (id=1):  follower_id=1, following_id=2
  - Eve (id=5):    follower_id=5, following_id=2
```

**Queries You Can Make**:
```sql
-- Who does Alice follow? (Alice's following list)
SELECT following_id FROM followers WHERE follower_id = 1 AND status = 'accepted';

-- Who follows Alice? (Alice's followers list)
SELECT follower_id FROM followers WHERE following_id = 1 AND status = 'accepted';

-- Pending follow requests for Alice
SELECT follower_id FROM followers WHERE following_id = 1 AND status = 'pending';
```

---

#### 6️⃣ **MESSAGES Table** - Private Conversations

**Purpose**: Stores private messages sent between users.

**Structure**:
```sql
CREATE TABLE messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Column Explanations**:
- **sender_id**: Who sent the message
- **receiver_id**: Who receives the message
- **content**: The message text
- **is_read**: Has the receiver read this message?
  - `false` = Unread (new message)
  - `true` = Read (receiver has seen it)

**Conversation Example**:
```
Conversation between Alice (id=1) and Bob (id=2):

Message 1: sender_id=1, receiver_id=2, content="Hi Bob!"
Message 2: sender_id=2, receiver_id=1, content="Hi Alice!"
Message 3: sender_id=1, receiver_id=2, content="How are you?"
Message 4: sender_id=2, receiver_id=1, content="I'm good, thanks!"
```

**Getting a Conversation**:
```sql
-- Get all messages between Alice (1) and Bob (2)
SELECT * FROM messages 
WHERE (sender_id = 1 AND receiver_id = 2) 
   OR (sender_id = 2 AND receiver_id = 1)
ORDER BY created_at ASC;
```

---

#### 7️⃣ **NOTIFICATIONS Table** - Activity Alerts

**Purpose**: Stores notifications about user activities (likes, comments, follows, etc.).

**Structure**:
```sql
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('like', 'comment', 'follow', 'follow_request', 'follow_accepted', 'mention') NOT NULL,
    sender_id INT NOT NULL,
    post_id INT,
    message VARCHAR(255),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
```

**Column Explanations**:
- **user_id**: Who receives this notification
- **type**: What kind of notification (like, comment, follow, etc.)
- **sender_id**: Who triggered this notification
- **post_id**: Related post (optional - not all notifications are about posts)
- **message**: Custom notification message
- **is_read**: Has the user seen this notification?

**Notification Types**:
1. **'like'**: Someone liked your post
   - user_id = post owner
   - sender_id = person who liked
   - post_id = the post that was liked
   
2. **'comment'**: Someone commented on your post
   - user_id = post owner
   - sender_id = person who commented
   - post_id = the post that was commented on
   
3. **'follow'**: Someone followed you
   - user_id = person being followed
   - sender_id = new follower
   - post_id = NULL (not related to a post)
   
4. **'follow_request'**: Someone requested to follow you
   - user_id = person receiving request
   - sender_id = person who wants to follow
   - post_id = NULL
   
5. **'follow_accepted'**: Your follow request was accepted
   - user_id = person whose request was accepted
   - sender_id = person who accepted
   - post_id = NULL
   
6. **'mention'**: Someone mentioned you in a comment
   - user_id = person mentioned
   - sender_id = person who mentioned
   - post_id = the post with the mention

**Example**:
```
Bob likes Alice's post:
  user_id = 1 (Alice - she gets the notification)
  type = 'like'
  sender_id = 2 (Bob - he triggered it)
  post_id = 10 (the post that was liked)
  message = "Bob liked your post"
  is_read = false (new notification)
```

---

#### 8️⃣ **STORIES Table** - Temporary Content

**Purpose**: Stores stories that automatically expire after 24 hours.

**Structure**:
```sql
CREATE TABLE stories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    image_url VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Column Explanations**:
- **expires_at**: When this story will be deleted
  - Set to 24 hours after `created_at`
  - Example: If created at "2024-01-15 10:00:00", expires at "2024-01-16 10:00:00"

**How Story Expiration Works**:
```javascript
// When creating a story:
created_at = NOW()  // e.g., 2024-01-15 10:00:00
expires_at = NOW() + 24 HOURS  // e.g., 2024-01-16 10:00:00

// Cleanup query (run periodically):
DELETE FROM stories WHERE expires_at < NOW();
```

**Why Stories?**
- Temporary content that disappears automatically
- Similar to Instagram/Facebook stories
- No manual deletion needed - automatic cleanup

---

#### 9️⃣ **SAVED_POSTS Table** - Bookmarks

**Purpose**: Stores posts that users have bookmarked/saved for later.

**Structure**:
```sql
CREATE TABLE saved_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_save (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
```

**Column Explanations**:
- **user_id**: Who saved the post
- **post_id**: Which post was saved
- **UNIQUE KEY**: A user can save a post only once

**Example**:
```
Alice (id=1) saves posts:
  - Post 5: user_id=1, post_id=5
  - Post 8: user_id=1, post_id=8
  - Post 12: user_id=1, post_id=12
```

---

### Table Relationships - The Big Picture

Understanding how tables connect to each other:

```
                                    USERS (id, username, email, ...)
                                           |
                    +----------------------+----------------------+
                    |                      |                      |
                 user_id                user_id               user_id
                    |                      |                      |
                 POSTS                 MESSAGES              FOLLOWERS
          (id, user_id, ...)      (sender_id, receiver_id)  (follower_id, following_id)
                    |
         +----------+----------+
         |          |          |
      post_id    post_id    post_id
         |          |          |
     COMMENTS    LIKES    SAVED_POSTS
```

**Relationship Types**:

1. **One-to-Many**: One user → Many posts
   - One user can create many posts
   - Each post belongs to exactly one user
   
2. **Many-to-Many**: Users ↔ Users (via followers)
   - One user can follow many users
   - One user can be followed by many users
   - Implemented using the `followers` join table
   
3. **Many-to-Many**: Users ↔ Posts (via likes)
   - One user can like many posts
   - One post can be liked by many users
   - Implemented using the `likes` join table

---

### Important SQL Concepts

#### 1. Indexes - Making Queries Fast

**What are Indexes?**
Indexes make searching faster, like an index in a book.

**Example**:
```sql
INDEX idx_username (username)
```

Without index:
```
To find username "alice", database checks:
Row 1: "bob" ❌
Row 2: "charlie" ❌
Row 3: "dave" ❌
...
Row 1000: "alice" ✅  (Found after checking 1000 rows!)
```

With index:
```
Database looks up "alice" in index → Goes directly to row 1000 ✅ (Instant!)
```

**Indexes in Our Database**:
- `idx_username` on users: Fast login lookups
- `idx_email` on users: Fast email lookups
- `idx_post_id` on comments: Fast "get all comments for a post"
- `idx_created_at` on posts: Fast "get latest posts"

#### 2. CASCADE Operations

**ON DELETE CASCADE** means:
```
When parent is deleted → Children are automatically deleted
```

Example:
```
User (id=5) is deleted
  ↓ ON DELETE CASCADE
  ↓ Automatically deletes:
  - All posts by user 5
  - All comments by user 5
  - All likes by user 5
  - All messages sent/received by user 5
  - All notifications for user 5
  - All follow relationships with user 5
  - All saved posts by user 5
  - All stories by user 5
```

**Why?** Prevents orphaned data (posts without owners).

#### 3. DEFAULT Values

**DEFAULT** provides a value if none is specified:

```sql
profile_picture VARCHAR(255) DEFAULT 'default-avatar.png'
```

When creating a user without a profile picture:
```sql
INSERT INTO users (username, email, password) VALUES ('alice', 'alice@example.com', 'hashed_password');
```
Result: `profile_picture` is automatically set to `'default-avatar.png'`

#### 4. AUTO_INCREMENT

**AUTO_INCREMENT** automatically generates unique IDs:

```sql
id INT PRIMARY KEY AUTO_INCREMENT
```

Example:
```
First user:  id = 1 (automatic)
Second user: id = 2 (automatic)
Third user:  id = 3 (automatic)
```

You never specify the `id` when inserting - it's automatic!

#### 5. TIMESTAMP and Automatic Updates

**CURRENT_TIMESTAMP**: Sets to current date/time
**ON UPDATE CURRENT_TIMESTAMP**: Updates automatically when row changes

```sql
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Set once when created
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP  -- Updates every time row is modified
```

Example:
```
User created: 
  created_at = "2024-01-15 10:00:00"
  updated_at = "2024-01-15 10:00:00"

User updates their bio:
  created_at = "2024-01-15 10:00:00"  (unchanged)
  updated_at = "2024-01-15 15:30:00"  (automatically updated!)
```

---

## 📥 Installation Guide

### Prerequisites
Before you start, make sure you have these installed:
- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MySQL** (v8.0 or higher) - [Download](https://dev.mysql.com/downloads/)
- **Git** - [Download](https://git-scm.com/)

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd social-connect
```

### Step 2: Install Dependencies

**Install Server Dependencies:**
```bash
cd server
npm install
```

**Install Client Dependencies:**
```bash
cd ../client
npm install
```

### Step 3: Setup Database

**Option 1: Using MySQL Command Line**
```bash
# Login to MySQL
mysql -u root -p

# Run the setup script
source database/MASTER_SETUP.sql

# Exit MySQL
exit
```

**Option 2: Using MySQL Workbench**
1. Open MySQL Workbench
2. Connect to your MySQL server
3. Open the file `database/MASTER_SETUP.sql`
4. Execute the script (click the lightning bolt icon)

**What This Does:**
- Creates a database named `socialconnect`
- Creates all 9 tables (users, posts, comments, likes, followers, messages, notifications, stories, saved_posts)
- Sets up all relationships and constraints
- Adds indexes for performance
- Prepares the database for use

### Step 4: Configure Environment Variables

**Create `.env` file in the `server` directory:**
```bash
cd server
# On Windows, create .env file manually
# On Mac/Linux, use: touch .env
```

**Add the following content to `.env`:**
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=socialconnect

# JWT Secret (change this to a random string)
JWT_SECRET=your_super_secret_jwt_key_here_change_this

# Client URL
CLIENT_URL=http://localhost:3000

# Azure Storage (Optional - for cloud image storage)
AZURE_STORAGE_CONNECTION_STRING=your_azure_connection_string_here
```

**Important**: Replace `your_mysql_password` with your actual MySQL password!

### Step 5: Start the Application

**Terminal 1 - Start the Backend Server:**
```bash
cd server
npm start
```

You should see:
```
🚀 SocialConnect Server Started Successfully!
📡 Server running on port 5000
🌍 Environment: development
🗄️  Database: socialconnect
🔗 Client URL: http://localhost:3000
```

**Terminal 2 - Start the Frontend Client:**
```bash
cd client
npm start
```

The application will open automatically in your browser at `http://localhost:3000`

### Step 6: Verify Installation

1. **Check Server Health:**
   Open `http://localhost:5000/api/health` in your browser
   You should see: `{"success": true, "message": "Server is running"}`

2. **Check Database Connection:**
   - Try registering a new user
   - If successful, database is connected!

---

## 🔌 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

### 🔐 Authentication Endpoints

#### Register a New User
```
POST /api/auth/register
```

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securePassword123",
  "display_name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "display_name": "John Doe"
  }
}
```

#### Login
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe"
  }
}
```

#### Get Current User
```
GET /api/auth/me
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "display_name": "John Doe",
    "bio": "Hello, I'm John!",
    "profile_picture": "default-avatar.png"
  }
}
```

---

### 👤 User Endpoints

#### Get User Profile
```
GET /api/users/:username
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "johndoe",
    "display_name": "John Doe",
    "bio": "Hello, I'm John!",
    "profile_picture": "default-avatar.png",
    "location": "New York, USA",
    "website": "https://johndoe.com",
    "followers_count": 150,
    "following_count": 200,
    "posts_count": 45
  }
}
```

#### Update Profile
```
PUT /api/users/profile
```

**Request Body (multipart/form-data):**
```
display_name: "John Doe Updated"
bio: "New bio"
location: "Los Angeles, USA"
profile_picture: <file>
```

#### Follow User
```
POST /api/users/:userId/follow
```

**Response:**
```json
{
  "success": true,
  "message": "Follow request sent",
  "status": "pending"
}
```

#### Unfollow User
```
DELETE /api/users/:userId/unfollow
```

#### Get Follow Requests
```
GET /api/users/follow-requests
```

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "id": 1,
      "follower_id": 5,
      "username": "alice123",
      "display_name": "Alice Smith",
      "profile_picture": "alice.jpg",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Accept Follow Request
```
POST /api/users/follow-requests/:requestId/accept
```

#### Search Users
```
GET /api/users/search?q=john
```

---

### 📝 Post Endpoints

#### Create Post
```
POST /api/posts
```

**Request Body (multipart/form-data):**
```
caption: "Beautiful sunset! #nature #photography"
image: <file>
```

**Response:**
```json
{
  "success": true,
  "post": {
    "id": 10,
    "user_id": 1,
    "caption": "Beautiful sunset! #nature #photography",
    "image_url": "posts/image-123456.jpg",
    "hashtags": ["nature", "photography"],
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Get Feed Posts (Following)
```
GET /api/posts/feed?page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "posts": [
    {
      "id": 10,
      "user": {
        "id": 2,
        "username": "alice",
        "display_name": "Alice",
        "profile_picture": "alice.jpg"
      },
      "caption": "Beautiful sunset!",
      "image_url": "posts/image-123.jpg",
      "likes_count": 25,
      "comments_count": 5,
      "is_liked": false,
      "is_saved": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100
  }
}
```

#### Like Post
```
POST /api/posts/:postId/like
```

#### Unlike Post
```
DELETE /api/posts/:postId/unlike
```

#### Add Comment
```
POST /api/posts/:postId/comment
```

**Request Body:**
```json
{
  "content": "Great photo!"
}
```

#### Get Comments
```
GET /api/posts/:postId/comments?page=1&limit=20
```

#### Save Post
```
POST /api/posts/:postId/save
```

#### Get Saved Posts
```
GET /api/posts/saved
```

#### Delete Post
```
DELETE /api/posts/:postId
```

---

### 💬 Message Endpoints

#### Get Conversations
```
GET /api/messages/conversations
```

**Response:**
```json
{
  "success": true,
  "conversations": [
    {
      "user": {
        "id": 2,
        "username": "alice",
        "display_name": "Alice",
        "profile_picture": "alice.jpg"
      },
      "last_message": {
        "content": "Hello!",
        "created_at": "2024-01-15T10:30:00Z",
        "is_read": true
      },
      "unread_count": 0
    }
  ]
}
```

#### Get Messages with User
```
GET /api/messages/:userId?page=1&limit=50
```

#### Send Message
```
POST /api/messages
```

**Request Body:**
```json
{
  "receiver_id": 2,
  "content": "Hello, how are you?"
}
```

#### Mark Message as Read
```
PUT /api/messages/:messageId/read
```

---

### 🔔 Notification Endpoints

#### Get Notifications
```
GET /api/notifications?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": 1,
      "type": "like",
      "sender": {
        "id": 2,
        "username": "alice",
        "profile_picture": "alice.jpg"
      },
      "post_id": 10,
      "message": "alice liked your post",
      "is_read": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Mark All as Read
```
PUT /api/notifications/read
```

#### Get Unread Count
```
GET /api/notifications/unread-count
```

---

### 📖 Story Endpoints

#### Create Story
```
POST /api/stories
```

**Request Body (multipart/form-data):**
```
image: <file>
```

#### Get Stories
```
GET /api/stories
```

**Response:**
```json
{
  "success": true,
  "stories": [
    {
      "user": {
        "id": 2,
        "username": "alice",
        "profile_picture": "alice.jpg"
      },
      "stories": [
        {
          "id": 1,
          "image_url": "stories/story-123.jpg",
          "created_at": "2024-01-15T10:30:00Z",
          "expires_at": "2024-01-16T10:30:00Z"
        }
      ]
    }
  ]
}
```

#### Delete Story
```
DELETE /api/stories/:storyId
```

---

## 📁 Project Structure

```
social-connect/
│
├── client/                          # React frontend
│   ├── public/                      # Static files
│   │   └── index.html               # HTML template
│   ├── src/
│   │   ├── components/              # Reusable React components
│   │   │   ├── common/
│   │   │   │   └── PrivateRoute.js  # Protected route wrapper
│   │   │   ├── Layout/
│   │   │   │   ├── Header.js        # Top navigation bar
│   │   │   │   ├── Sidebar.js       # Side navigation menu
│   │   │   │   └── Layout.js        # Main layout wrapper
│   │   │   ├── Post/
│   │   │   │   ├── CreatePost.js    # Create new post form
│   │   │   │   ├── PostCard.js      # Single post display
│   │   │   │   ├── PostModal.js     # Post detail modal
│   │   │   │   └── DeletePostDialog.js
│   │   │   ├── Profile/
│   │   │   │   └── ProfilePictureUpload.js
│   │   │   ├── Story/
│   │   │   │   ├── CreateStory.js   # Create story form
│   │   │   │   ├── StoryBar.js      # Stories horizontal bar
│   │   │   │   └── StoryViewer.js   # View story modal
│   │   │   └── User/
│   │   │       ├── FollowersModal.js
│   │   │       ├── FollowingModal.js
│   │   │       └── FollowRequestsDialog.js
│   │   ├── context/                 # React Context for state management
│   │   │   ├── AuthContext.js       # Authentication state
│   │   │   └── SocketContext.js     # WebSocket connection
│   │   ├── pages/                   # Main page components
│   │   │   ├── Home.js              # Home feed
│   │   │   ├── Login.js             # Login page
│   │   │   ├── Register.js          # Registration page
│   │   │   ├── Profile.js           # User profile page
│   │   │   ├── Messages.js          # Messages page
│   │   │   ├── Notifications.js     # Notifications page
│   │   │   ├── Search.js            # Search page
│   │   │   ├── Activity.js          # Activity feed
│   │   │   └── Saved.js             # Saved posts page
│   │   ├── services/
│   │   │   └── api.js               # API client and endpoints
│   │   ├── utils/                   # Utility functions
│   │   │   ├── followUtils.js       # Follow/unfollow helpers
│   │   │   └── imageUtils.js        # Image processing helpers
│   │   ├── theme.js                 # MUI theme configuration
│   │   ├── App.js                   # Main App component
│   │   └── index.js                 # React entry point
│   └── package.json                 # Frontend dependencies
│
├── server/                          # Node.js backend
│   ├── config/
│   │   └── db.js                    # MySQL connection configuration
│   ├── controllers/                 # Business logic
│   │   ├── authController.js        # Authentication logic
│   │   ├── userController.js        # User management logic
│   │   ├── postController.js        # Post management logic
│   │   ├── messageController.js     # Messaging logic
│   │   ├── notificationController.js# Notification logic
│   │   └── storyController.js       # Story management logic
│   ├── middleware/
│   │   ├── auth.js                  # JWT authentication middleware
│   │   └── upload.js                # File upload middleware (Multer)
│   ├── models/
│   │   └── db.js                    # Database query functions
│   ├── routes/                      # API routes
│   │   ├── auth.js                  # Authentication routes
│   │   ├── users.js                 # User routes
│   │   ├── posts.js                 # Post routes
│   │   ├── messages.js              # Message routes
│   │   ├── notifications.js         # Notification routes
│   │   └── stories.js               # Story routes
│   ├── scripts/
│   │   ├── setup-database.js        # Database setup script
│   │   └── migrateToAzure.js        # Azure migration script
│   ├── services/
│   │   └── azureStorage.js          # Azure Blob Storage service
│   ├── uploads/                     # Local file uploads
│   │   ├── posts/                   # Post images
│   │   ├── profiles/                # Profile pictures
│   │   └── stories/                 # Story images
│   ├── server.js                    # Main server file
│   ├── package.json                 # Backend dependencies
│   └── .env                         # Environment variables (create this)
│
├── database/
│   └── MASTER_SETUP.sql             # Complete database setup script
│
└── README.md                        # This file
```

---

## ⚡ Real-Time Features

SocialConnect uses **Socket.IO** for real-time communication:

### Real-Time Events

#### User Presence
```javascript
// User comes online
socket.emit('user:join', userId);

// Notify others when user is online
socket.on('user:online', (userId) => {
  console.log(`User ${userId} is now online`);
});

// Notify others when user goes offline
socket.on('user:offline', (userId) => {
  console.log(`User ${userId} is now offline`);
});
```

#### Messaging
```javascript
// Send a message
socket.emit('message:send', {
  receiverId: 2,
  message: {
    content: "Hello!",
    timestamp: new Date()
  }
});

// Receive a message
socket.on('message:receive', (message) => {
  console.log('New message:', message);
});
```

#### Typing Indicators
```javascript
// Start typing
socket.emit('typing:start', { receiverId: 2 });

// Stop typing
socket.emit('typing:stop', { receiverId: 2 });

// Listen for typing events
socket.on('typing:start', ({ userId }) => {
  console.log(`User ${userId} is typing...`);
});
```

#### Notifications
```javascript
// Send notification
socket.emit('notification:send', {
  userId: 2,
  notification: {
    type: 'like',
    message: 'Someone liked your post'
  }
});

// Receive notification
socket.on('notification:receive', (notification) => {
  console.log('New notification:', notification);
  // Show notification toast/alert
});
```

---

## 🔒 Security Features

### 1. Password Encryption
- Passwords are hashed using **bcryptjs** before storing
- Never stored as plain text
- Hash verification on login

```javascript
// Password hashing
const hashedPassword = await bcrypt.hash(password, 10);

// Password verification
const isValid = await bcrypt.compare(inputPassword, storedHash);
```

### 2. JWT Authentication
- Secure token-based authentication
- Token expires after a set time
- Token required for protected routes

```javascript
// Generate token
const token = jwt.sign(
  { userId: user.id, username: user.username },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

// Verify token
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### 3. SQL Injection Prevention
- Using parameterized queries
- MySQL2 library with prepared statements

```javascript
// Safe query
const [users] = await db.execute(
  'SELECT * FROM users WHERE username = ?',
  [username]
);
```

### 4. File Upload Security
- File type validation (only images allowed)
- File size limits (5MB maximum)
- Unique filename generation

### 5. CORS Protection
- Configured to allow only specific origins
- Credentials support for cookies/auth headers

---

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=5000
DB_HOST=your_production_db_host
DB_USER=your_production_db_user
DB_PASSWORD=your_production_db_password
DB_NAME=socialconnect
JWT_SECRET=your_very_secure_jwt_secret
CLIENT_URL=https://your-domain.com
AZURE_STORAGE_CONNECTION_STRING=your_azure_connection
```

### Building for Production

**Backend:**
```bash
cd server
npm install --production
npm start
```

**Frontend:**
```bash
cd client
npm run build
# Serve the build folder using a static file server
```

---

## 📊 Database Maintenance

### Cleanup Expired Stories
Run this periodically (e.g., every hour):
```sql
DELETE FROM stories WHERE expires_at < NOW();
```

### Backup Database
```bash
mysqldump -u root -p socialconnect > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
mysql -u root -p socialconnect < backup_20240115.sql
```

---

## 🐛 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Solution:**
- Make sure MySQL is running
- Check DB credentials in `.env`
- Verify database exists: `SHOW DATABASES;`

### Port Already in Use
```
Error: listen EADDRINUSE :::5000
```
**Solution:**
- Change PORT in `.env`
- Or kill the process using port 5000

### JWT Token Errors
```
Error: invalid token
```
**Solution:**
- Clear browser local storage
- Login again to get new token
- Check JWT_SECRET matches in `.env`

---

## 📝 License

This project is open source and available for educational purposes.

---

## 👥 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

---

## 📧 Support

For questions or issues:
- Open an issue on GitHub
- Contact the development team

---

**Made with ❤️ by the SocialConnect Team**
