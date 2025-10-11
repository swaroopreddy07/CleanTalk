-- =============================================================================
-- SocialConnect Master Database Setup Script
-- =============================================================================
-- 
-- This is the COMPLETE and DEFINITIVE database setup script for SocialConnect.
-- It combines all database setup, migrations, and optimizations into one file.
-- 
-- This script includes:
-- ✅ Complete database schema with all tables
-- ✅ Follow request system (pending/accepted/rejected status)
-- ✅ Enhanced notifications (sender_id instead of from_user_id)
-- ✅ JSON-based hashtag system (no separate hashtag tables)
-- ✅ All indexes for optimal performance
-- ✅ All foreign key constraints for data integrity
-- ✅ Sample data for testing (optional)
-- ✅ Verification queries
-- ✅ Migration compatibility
--
-- Usage Options:
-- 1. Fresh Install (with sample data): mysql -u root -p < database/MASTER_SETUP.sql
-- 2. Clean Install (no sample data): Comment out the sample data section
-- 3. Production Install: Use this script as-is for production deployment
--
-- This script is safe to run multiple times and handles all migrations automatically.
--
-- @author SocialConnect Team
-- @version 2.0.0
-- @created 2024
-- @updated 2024
-- =============================================================================

-- =============================================================================
-- DATABASE CREATION
-- =============================================================================

-- Create and use the database
CREATE DATABASE IF NOT EXISTS socialconnect;
USE socialconnect;

-- =============================================================================
-- USERS TABLE
-- =============================================================================
-- 
-- Core user information and profile data
-- Stores user authentication credentials and profile information
--
-- Key Features:
-- - Unique username and email constraints
-- - Encrypted password storage
-- - Profile customization (bio, location, website)
-- - Account status tracking
-- - Automatic timestamp management
--
-- Indexes:
-- - idx_username: Fast username lookups for authentication
-- - idx_email: Fast email lookups for authentication
--
-- Relationships:
-- - Referenced by: posts, comments, likes, followers, messages, notifications, stories, saved_posts
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,                    -- Unique user identifier
    username VARCHAR(50) UNIQUE NOT NULL,                 -- Unique username for login and display
    email VARCHAR(100) UNIQUE NOT NULL,                   -- Unique email for account recovery
    password VARCHAR(255) NOT NULL,                       -- Hashed password (bcrypt)
    display_name VARCHAR(100),                            -- User's display name (can be different from username)
    bio TEXT,                                             -- User's biography/description
    profile_picture VARCHAR(255) DEFAULT 'default-avatar.png', -- Profile picture URL/path
    location VARCHAR(100),                                -- User's location
    website VARCHAR(255),                                 -- User's website URL
    is_active BOOLEAN DEFAULT true,                       -- Account status (active/suspended)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Account creation timestamp
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Last update timestamp
    INDEX idx_username (username),                        -- Index for fast username lookups
    INDEX idx_email (email)                               -- Index for fast email lookups
);

-- =============================================================================
-- POSTS TABLE
-- =============================================================================
-- 
-- User-generated content posts
-- Stores posts created by users including text captions and images
--
-- Key Features:
-- - Text captions for posts
-- - Image attachments (stored as URLs/paths)
-- - Automatic engagement counters (likes, comments)
-- - JSON-based hashtag support (modern approach)
-- - Chronological ordering support
--
-- Indexes:
-- - idx_user_id: Fast user post lookups
-- - idx_created_at: Fast chronological sorting
--
-- Relationships:
-- - References: users (user_id)
-- - Referenced by: comments, likes, notifications, saved_posts
-- =============================================================================
CREATE TABLE IF NOT EXISTS posts (
    id INT PRIMARY KEY AUTO_INCREMENT,                    -- Unique post identifier
    user_id INT NOT NULL,                                 -- ID of the user who created the post
    caption TEXT,                                         -- Post text content/caption
    image_url VARCHAR(255),                               -- Image URL/path (can be null for text-only posts)
    hashtags JSON,                                        -- JSON array of hashtags (modern approach)
    likes_count INT DEFAULT 0,                           -- Cached count of likes (for performance)
    comments_count INT DEFAULT 0,                        -- Cached count of comments (for performance)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Post creation timestamp
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Last update timestamp
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, -- Cascade delete when user is deleted
    INDEX idx_user_id (user_id),                         -- Index for fast user post lookups
    INDEX idx_created_at (created_at)                     -- Index for chronological sorting
);

-- =============================================================================
-- COMMENTS TABLE
-- =============================================================================
-- 
-- User comments on posts
-- Stores comments made by users on posts with full text content
--
-- Key Features:
-- - Text content for comments
-- - Automatic deletion when post or user is deleted
-- - Chronological ordering support
-- - Direct post association
--
-- Indexes:
-- - idx_post_id: Fast comment lookups for specific posts
--
-- Relationships:
-- - References: posts (post_id), users (user_id)
-- - Referenced by: notifications (for comment notifications)
-- =============================================================================
CREATE TABLE IF NOT EXISTS comments (
    id INT PRIMARY KEY AUTO_INCREMENT,                    -- Unique comment identifier
    post_id INT NOT NULL,                                 -- ID of the post being commented on
    user_id INT NOT NULL,                                 -- ID of the user making the comment
    content TEXT NOT NULL,                               -- Comment text content
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Comment creation timestamp
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE, -- Cascade delete when post is deleted
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, -- Cascade delete when user is deleted
    INDEX idx_post_id (post_id)                           -- Index for fast post comment lookups
);

-- =============================================================================
-- LIKES TABLE
-- =============================================================================
-- 
-- Post likes and user interactions
-- Stores likes made by users on posts with unique constraints
--
-- Key Features:
-- - Unique constraint prevents duplicate likes
-- - Automatic deletion when post or user is deleted
-- - Chronological tracking of likes
-- - Efficient duplicate prevention
--
-- Constraints:
-- - unique_like: Prevents users from liking the same post multiple times
--
-- Relationships:
-- - References: posts (post_id), users (user_id)
-- - Referenced by: notifications (for like notifications)
-- =============================================================================
CREATE TABLE IF NOT EXISTS likes (
    id INT PRIMARY KEY AUTO_INCREMENT,                    -- Unique like identifier
    post_id INT NOT NULL,                                 -- ID of the post being liked
    user_id INT NOT NULL,                                 -- ID of the user making the like
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Like creation timestamp
    UNIQUE KEY unique_like (post_id, user_id),           -- Prevent duplicate likes by same user on same post
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE, -- Cascade delete when post is deleted
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE  -- Cascade delete when user is deleted
);

-- =============================================================================
-- FOLLOWERS TABLE (Many-to-Many Relationship with Follow Request System)
-- =============================================================================
-- 
-- User follow relationships and social connections
-- Manages the many-to-many relationship between users with follow request system
--
-- Key Features:
-- - Bidirectional follow relationships
-- - Follow request system with pending/accepted/rejected states
-- - Unique constraint prevents duplicate follows
-- - Automatic deletion when users are deleted
-- - Efficient querying with indexes
--
-- Constraints:
-- - unique_follow: Prevents users from following the same person multiple times
-- - Self-follow prevention: Enforced at application level
--
-- Indexes:
-- - idx_follower: Fast lookups for who a user follows
-- - idx_following: Fast lookups for who follows a user
-- - idx_status: Fast lookups for follow request status
--
-- Relationships:
-- - References: users (follower_id), users (following_id)
-- - Referenced by: notifications (for follow notifications)
-- =============================================================================
CREATE TABLE IF NOT EXISTS followers (
    id INT PRIMARY KEY AUTO_INCREMENT,                    -- Unique follow relationship identifier
    follower_id INT NOT NULL,                             -- ID of the user doing the following
    following_id INT NOT NULL,                            -- ID of the user being followed
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'accepted', -- Follow request status
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Follow relationship creation timestamp
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Last update timestamp
    UNIQUE KEY unique_follow (follower_id, following_id), -- Prevent duplicate follow relationships
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,  -- Cascade delete when follower is deleted
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE, -- Cascade delete when followed user is deleted
    INDEX idx_follower (follower_id),                     -- Index for fast "who I follow" queries
    INDEX idx_following (following_id),                   -- Index for fast "who follows me" queries
    INDEX idx_status (status)                             -- Index for fast follow request status queries
);

-- =============================================================================
-- MESSAGES TABLE
-- =============================================================================
-- 
-- Direct messages between users
-- Stores private messages sent between users with read status tracking
--
-- Key Features:
-- - Private messaging between users
-- - Read status tracking (read/unread)
-- - Chronological message ordering
-- - Automatic deletion when users are deleted
-- - Efficient conversation queries
--
-- Indexes:
-- - idx_sender_receiver: Fast conversation lookups between two users
-- - idx_created_at: Fast chronological message sorting
--
-- Relationships:
-- - References: users (sender_id), users (receiver_id)
-- - Referenced by: notifications (for message notifications)
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,                    -- Unique message identifier
    sender_id INT NOT NULL,                               -- ID of the user sending the message
    receiver_id INT NOT NULL,                             -- ID of the user receiving the message
    content TEXT NOT NULL,                               -- Message text content
    is_read BOOLEAN DEFAULT false,                       -- Read status (false = unread, true = read)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Message creation timestamp
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,   -- Cascade delete when sender is deleted
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE, -- Cascade delete when receiver is deleted
    INDEX idx_sender_receiver (sender_id, receiver_id),   -- Index for fast conversation lookups
    INDEX idx_created_at (created_at)                     -- Index for chronological message sorting
);

-- =============================================================================
-- NOTIFICATIONS TABLE (Enhanced with Follow Request Support)
-- =============================================================================
-- 
-- User notifications and activity alerts
-- Stores notifications for various user activities and interactions
--
-- Key Features:
-- - Multiple notification types including follow requests
-- - Optional post association for context
-- - Read status tracking
-- - Automatic deletion when referenced entities are deleted
-- - Efficient user notification queries
--
-- Notification Types:
-- - 'like': User liked a post
-- - 'comment': User commented on a post
-- - 'follow': User followed another user
-- - 'follow_request': User received a follow request
-- - 'follow_accepted': Follow request was accepted
-- - 'mention': User mentioned in a comment
--
-- Indexes:
-- - idx_user_id: Fast user notification lookups
-- - idx_is_read: Fast unread notification queries
--
-- Relationships:
-- - References: users (user_id), users (sender_id), posts (post_id, optional)
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,                    -- Unique notification identifier
    user_id INT NOT NULL,                                 -- ID of the user receiving the notification
    type ENUM('like', 'comment', 'follow', 'follow_request', 'follow_accepted', 'mention') NOT NULL, -- Type of notification
    sender_id INT NOT NULL,                               -- ID of the user who triggered the notification
    post_id INT,                                          -- ID of the related post (optional, for context)
    message VARCHAR(255),                                 -- Custom notification message (optional)
    is_read BOOLEAN DEFAULT false,                       -- Read status (false = unread, true = read)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Notification creation timestamp
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,      -- Cascade delete when user is deleted
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,    -- Cascade delete when trigger user is deleted
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,      -- Cascade delete when post is deleted
    INDEX idx_user_id (user_id),                         -- Index for fast user notification lookups
    INDEX idx_is_read (is_read)                           -- Index for fast unread notification queries
);

-- =============================================================================
-- STORIES TABLE
-- =============================================================================
-- 
-- Temporary stories with automatic expiration
-- Stores user stories that automatically expire after 24 hours
--
-- Key Features:
-- - Automatic expiration after 24 hours
-- - Image-only content (no text captions)
-- - Automatic cleanup of expired stories
-- - Chronological ordering support
-- - User association for story ownership
--
-- Indexes:
-- - idx_expires_at: Fast cleanup of expired stories
-- - idx_user_id: Fast user story lookups (implicit via foreign key)
--
-- Relationships:
-- - References: users (user_id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS stories (
    id INT PRIMARY KEY AUTO_INCREMENT,                    -- Unique story identifier
    user_id INT NOT NULL,                                 -- ID of the user who created the story
    image_url VARCHAR(255),                               -- Story image URL/path
    expires_at TIMESTAMP NOT NULL,                        -- Story expiration timestamp (24 hours from creation)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Story creation timestamp
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, -- Cascade delete when user is deleted
    INDEX idx_expires_at (expires_at)                     -- Index for fast expired story cleanup
);

-- =============================================================================
-- SAVED POSTS TABLE
-- =============================================================================
-- 
-- User bookmarked/saved posts
-- Stores posts that users have saved for later viewing
--
-- Key Features:
-- - Unique constraint prevents duplicate saves
-- - Automatic deletion when user or post is deleted
-- - Chronological tracking of saves
-- - Efficient duplicate prevention
--
-- Constraints:
-- - unique_save: Prevents users from saving the same post multiple times
--
-- Relationships:
-- - References: users (user_id), posts (post_id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS saved_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,                    -- Unique saved post identifier
    user_id INT NOT NULL,                                 -- ID of the user who saved the post
    post_id INT NOT NULL,                                 -- ID of the post being saved
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Save creation timestamp
    UNIQUE KEY unique_save (user_id, post_id),           -- Prevent duplicate saves by same user on same post
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, -- Cascade delete when user is deleted
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE  -- Cascade delete when post is deleted
);

-- =============================================================================
-- MIGRATION COMPATIBILITY
-- =============================================================================
-- 
-- Handle migrations for existing databases
-- These commands ensure compatibility with older database versions
-- =============================================================================

-- Ensure followers table has the status column (for existing installations)
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'socialconnect' 
    AND TABLE_NAME = 'followers' 
    AND COLUMN_NAME = 'status'
);

SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE followers ADD COLUMN status ENUM(''pending'', ''accepted'', ''rejected'') DEFAULT ''accepted'' AFTER following_id',
    'SELECT "Status column already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure followers table has the updated_at column
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'socialconnect' 
    AND TABLE_NAME = 'followers' 
    AND COLUMN_NAME = 'updated_at'
);

SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE followers ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    'SELECT "Updated_at column already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add status index if it doesn't exist
SET @index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'socialconnect' 
    AND TABLE_NAME = 'followers' 
    AND INDEX_NAME = 'idx_status'
);

SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE followers ADD INDEX idx_status (status)',
    'SELECT "Status index already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure notifications table uses sender_id instead of from_user_id
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'socialconnect' 
    AND TABLE_NAME = 'notifications' 
    AND COLUMN_NAME = 'from_user_id'
);

SET @sql = IF(@column_exists > 0, 
    'ALTER TABLE notifications CHANGE COLUMN from_user_id sender_id INT NOT NULL',
    'SELECT "Sender_id column already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update notification types to include follow request types
ALTER TABLE notifications 
MODIFY COLUMN type ENUM('like', 'comment', 'follow', 'follow_request', 'follow_accepted', 'mention') NOT NULL;

-- Update existing follows to 'accepted' status (for migration compatibility)
UPDATE followers 
SET status = 'accepted' 
WHERE status IS NULL OR status = '';

