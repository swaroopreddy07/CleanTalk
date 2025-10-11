# 📚 Complete SQL Guide for SocialConnect Database

## Table of Contents
- [Introduction to Databases and SQL](#introduction-to-databases-and-sql)
- [Understanding the SocialConnect Database](#understanding-the-socialconnect-database)
- [SQL Query Examples](#sql-query-examples)
- [Advanced SQL Concepts](#advanced-sql-concepts)
- [Performance Optimization](#performance-optimization)
- [Common Operations](#common-operations)
- [Troubleshooting](#troubleshooting)

---

## 📖 Introduction to Databases and SQL

### What is a Database?

Imagine a library with thousands of books. Without organization, finding a specific book would be nearly impossible. A database is like an organized library for digital information, where:

- **Data is organized** into tables (like different sections in a library)
- **Data can be quickly searched** (like having a card catalog)
- **Data relationships are maintained** (like knowing which books are by the same author)
- **Data integrity is ensured** (like making sure book checkout records are accurate)

### Why Use a Database Instead of Files?

❌ **Without Database (Using Files):**
```
users.txt:
john,john@email.com,password123,New York
alice,alice@email.com,pass456,LA

posts.txt:
1,john,Beautiful sunset!,image1.jpg
2,alice,Great day!,image2.jpg

Problems:
- Hard to search
- No relationships
- Risk of duplicate data
- No data validation
- Difficult to handle concurrent users
```

✅ **With Database (Using SQL):**
```sql
Users Table:
+----+----------+------------------+------------------+
| id | username | email            | location         |
+----+----------+------------------+------------------+
|  1 | john     | john@email.com   | New York         |
|  2 | alice    | alice@email.com  | LA               |
+----+----------+------------------+------------------+

Posts Table:
+----+---------+------------------+--------------+
| id | user_id | caption          | image_url    |
+----+---------+------------------+--------------+
|  1 |       1 | Beautiful sunset!| image1.jpg   |
|  2 |       2 | Great day!       | image2.jpg   |
+----+---------+------------------+--------------+

Benefits:
✓ Lightning-fast searches
✓ Clear relationships (user_id links to users.id)
✓ No duplicates (unique constraints)
✓ Data validation (constraints, data types)
✓ Multiple users can access simultaneously
```

### What is SQL?

**SQL** stands for **Structured Query Language**. It's the language we use to:
- **Ask questions** about data (SELECT)
- **Add new information** (INSERT)
- **Modify existing data** (UPDATE)
- **Remove data** (DELETE)
- **Create structure** (CREATE TABLE)

Think of SQL as English for databases. Just like you might say:
- "Show me all users from New York" → `SELECT * FROM users WHERE location = 'New York'`
- "Add a new user named John" → `INSERT INTO users (username) VALUES ('john')`
- "Change Alice's location to Boston" → `UPDATE users SET location = 'Boston' WHERE username = 'alice'`

---

## 🗂️ Understanding the SocialConnect Database

### Database Structure Overview

Our SocialConnect database consists of **9 interconnected tables**:

```
┌─────────────────────────────────────────────────────────────┐
│                         USERS                                │
│  (id, username, email, password, profile info)               │
└────────────┬──────────────┬──────────────┬──────────────────┘
             │              │              │
     ┌───────┴───────┐  ┌──┴──────┐   ┌──┴──────┐
     │               │  │         │   │         │
┌────▼────┐   ┌─────▼──┐ │  ┌────▼─┐  │  ┌─────▼──────┐
│ POSTS   │   │FOLLOWERS│ │  │MESSAGES│ │  │NOTIFICATIONS│
│         │   │         │ │  │      │ │  │            │
└────┬────┘   └─────────┘ │  └──────┘ │  └────────────┘
     │                     │           │
  ┌──┴──┬──────┬──────────┘           │
  │     │      │                       │
┌─▼─┐ ┌─▼───┐ ┌▼──────┐          ┌───▼────┐
│LIKES│COMMENTS│SAVED_  │          │STORIES │
│     │       │POSTS   │          │        │
└─────┘ └─────┘└────────┘          └────────┘
```

### Visual Table Representation

Let's see what actual data looks like in these tables:

#### USERS Table Example
```
+----+----------+-------------------+----------+--------------+--------+
| id | username | email             | password | display_name | bio    |
+----+----------+-------------------+----------+--------------+--------+
|  1 | john_doe | john@example.com  | $2a$10.. | John Doe     | Hello! |
|  2 | alice123 | alice@example.com | $2a$10.. | Alice Smith  | Hi!    |
|  3 | bob_2024 | bob@example.com   | $2a$10.. | Bob Johnson  | Hey!   |
+----+----------+-------------------+----------+--------------+--------+
```

#### POSTS Table Example
```
+----+---------+---------------------+--------------+------------+
| id | user_id | caption             | image_url    | likes_count|
+----+---------+---------------------+--------------+------------+
|  1 |       1 | Beautiful sunset!   | img1.jpg     |         25 |
|  2 |       2 | My new car!         | img2.jpg     |         15 |
|  3 |       1 | Vacation photos     | img3.jpg     |         42 |
+----+---------+---------------------+--------------+------------+
```

#### FOLLOWERS Table Example
```
+----+-------------+--------------+-----------+
| id | follower_id | following_id | status    |
+----+-------------+--------------+-----------+
|  1 |           2 |            1 | accepted  |  (Alice follows John)
|  2 |           3 |            1 | accepted  |  (Bob follows John)
|  3 |           1 |            2 | pending   |  (John wants to follow Alice - pending)
+----+-------------+--------------+-----------+
```

**Reading this table:**
- Row 1: User 2 (Alice) follows User 1 (John) - Status: accepted
- Row 2: User 3 (Bob) follows User 1 (John) - Status: accepted  
- Row 3: User 1 (John) requested to follow User 2 (Alice) - Status: pending

**To find John's followers:**
```sql
SELECT follower_id FROM followers WHERE following_id = 1 AND status = 'accepted';
-- Result: Alice (2), Bob (3)
```

**To find who John follows:**
```sql
SELECT following_id FROM followers WHERE follower_id = 1;
-- Result: Alice (2) - but status is pending
```

---

## 📝 SQL Query Examples

### Basic Queries (CRUD Operations)

CRUD stands for: **C**reate, **R**ead, **U**pdate, **D**elete

#### CREATE - Adding Data

**1. Register a New User**
```sql
INSERT INTO users (username, email, password, display_name, bio) 
VALUES ('john_doe', 'john@example.com', '$2a$10hashed...', 'John Doe', 'Hello, I am John!');
```

**What happens:**
```
Before:
users table is empty

After:
+----+----------+------------------+----------+--------------+-----------------+
| id | username | email            | password | display_name | bio             |
+----+----------+------------------+----------+--------------+-----------------+
|  1 | john_doe | john@example.com | $2a$10.. | John Doe     | Hello, I am John!|
+----+----------+------------------+----------+--------------+-----------------+
```

**2. Create a New Post**
```sql
INSERT INTO posts (user_id, caption, image_url, hashtags)
VALUES (1, 'My first post! #hello #newuser', 'post1.jpg', '["hello", "newuser"]');
```

**What happens:**
```
Before:
posts table is empty

After:
+----+---------+---------------------------+------------+-------------------+
| id | user_id | caption                   | image_url  | hashtags          |
+----+---------+---------------------------+------------+-------------------+
|  1 |       1 | My first post! #hello ... | post1.jpg  | ["hello","newuser"]|
+----+---------+---------------------------+------------+-------------------+
```

**3. User Follows Another User**
```sql
INSERT INTO followers (follower_id, following_id, status)
VALUES (2, 1, 'accepted');
```
Meaning: User 2 now follows User 1

---

#### READ - Retrieving Data

**1. Get All Users**
```sql
SELECT * FROM users;
```
`*` means "all columns"

**2. Get Specific User by Username**
```sql
SELECT id, username, email, display_name, bio 
FROM users 
WHERE username = 'john_doe';
```

**Result:**
```
+----+----------+------------------+--------------+-----------------+
| id | username | email            | display_name | bio             |
+----+----------+------------------+--------------+-----------------+
|  1 | john_doe | john@example.com | John Doe     | Hello, I am John!|
+----+----------+------------------+--------------+-----------------+
```

**3. Get All Posts by a Specific User**
```sql
SELECT * FROM posts WHERE user_id = 1 ORDER BY created_at DESC;
```
`ORDER BY created_at DESC` = Sort by newest first

**4. Get User's Followers**
```sql
SELECT follower_id FROM followers 
WHERE following_id = 1 AND status = 'accepted';
```
"Who follows user 1?"

**5. Count User's Followers**
```sql
SELECT COUNT(*) as follower_count 
FROM followers 
WHERE following_id = 1 AND status = 'accepted';
```

**Result:**
```
+----------------+
| follower_count |
+----------------+
|             15 |
+----------------+
```

**6. Search Users by Name**
```sql
SELECT username, display_name, profile_picture 
FROM users 
WHERE username LIKE '%john%' OR display_name LIKE '%john%';
```
`LIKE '%john%'` = Contains "john" anywhere in the text

**7. Get Latest Posts (Feed)**
```sql
SELECT 
    p.id,
    p.caption,
    p.image_url,
    p.likes_count,
    p.created_at,
    u.username,
    u.profile_picture
FROM posts p
JOIN users u ON p.user_id = u.id
ORDER BY p.created_at DESC
LIMIT 10;
```

**Explanation:**
- `FROM posts p` - Use posts table, call it 'p' for short
- `JOIN users u` - Connect to users table, call it 'u' for short  
- `ON p.user_id = u.id` - Match where post's user_id equals user's id
- `ORDER BY p.created_at DESC` - Newest first
- `LIMIT 10` - Only show 10 results

**Result:**
```
+----+------------------+------------+-------------+---------------------+----------+----------------+
| id | caption          | image_url  | likes_count | created_at          | username | profile_picture|
+----+------------------+------------+-------------+---------------------+----------+----------------+
|  5 | Great day!       | img5.jpg   |          10 | 2024-01-15 14:30:00 | alice123 | alice.jpg      |
|  4 | Sunset photo     | img4.jpg   |          25 | 2024-01-15 12:00:00 | john_doe | john.jpg       |
|  3 | Morning coffee   | img3.jpg   |           5 | 2024-01-15 09:00:00 | bob_2024 | bob.jpg        |
+----+------------------+------------+-------------+---------------------+----------+----------------+
```

---

#### UPDATE - Modifying Data

**1. Update User Profile**
```sql
UPDATE users 
SET bio = 'New bio text', location = 'New York'
WHERE id = 1;
```

**Before:**
```
+----+----------+--------+----------+
| id | username | bio    | location |
+----+----------+--------+----------+
|  1 | john_doe | Hello! | NULL     |
+----+----------+--------+----------+
```

**After:**
```
+----+----------+--------------+----------+
| id | username | bio          | location |
+----+----------+--------------+----------+
|  1 | john_doe | New bio text | New York |
+----+----------+--------------+----------+
```

**2. Mark Notification as Read**
```sql
UPDATE notifications 
SET is_read = true 
WHERE id = 5;
```

**3. Accept Follow Request**
```sql
UPDATE followers 
SET status = 'accepted' 
WHERE id = 10;
```

**4. Increment Post Likes Count**
```sql
UPDATE posts 
SET likes_count = likes_count + 1 
WHERE id = 3;
```

**Before:** likes_count = 10  
**After:** likes_count = 11

---

#### DELETE - Removing Data

**1. Delete a Post**
```sql
DELETE FROM posts WHERE id = 5;
```

**Important:** Due to `ON DELETE CASCADE`, this also automatically deletes:
- All likes on this post
- All comments on this post
- All notifications about this post
- All saved_posts entries for this post

**2. Delete a User (and Everything Related)**
```sql
DELETE FROM users WHERE id = 1;
```

**Cascade Effect - This automatically deletes:**
- All posts by user 1
- All comments by user 1
- All likes by user 1
- All messages sent/received by user 1
- All notifications for user 1
- All follower relationships with user 1
- All stories by user 1
- All saved posts by user 1

**3. Unlike a Post**
```sql
DELETE FROM likes WHERE user_id = 2 AND post_id = 10;
```

**4. Unfollow Someone**
```sql
DELETE FROM followers WHERE follower_id = 2 AND following_id = 1;
```
Meaning: User 2 unfollows User 1

---

### Advanced Queries

#### 1. Get User's Full Profile Information

```sql
SELECT 
    u.id,
    u.username,
    u.email,
    u.display_name,
    u.bio,
    u.profile_picture,
    u.location,
    u.website,
    COUNT(DISTINCT p.id) as posts_count,
    COUNT(DISTINCT f1.id) as followers_count,
    COUNT(DISTINCT f2.id) as following_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN followers f1 ON u.id = f1.following_id AND f1.status = 'accepted'
LEFT JOIN followers f2 ON u.id = f2.follower_id AND f2.status = 'accepted'
WHERE u.username = 'john_doe'
GROUP BY u.id;
```

**Explanation:**
- `COUNT(DISTINCT p.id)` - Count unique posts
- `LEFT JOIN` - Include user even if no posts/followers
- `GROUP BY u.id` - Combine all rows for same user

**Result:**
```
+----+----------+------------------+-----+------------+--------+-----------+-------------+
| id | username | display_name     |posts|followers   |following| location  | bio         |
+----+----------+------------------+-----+------------+--------+-----------+-------------+
|  1 | john_doe | John Doe         |  45 |        150 |    200 | New York  | Hello!      |
+----+----------+------------------+-----+------------+--------+-----------+-------------+
```

#### 2. Get Feed Posts (Only from Users You Follow)

```sql
SELECT 
    p.id,
    p.caption,
    p.image_url,
    p.likes_count,
    p.comments_count,
    p.created_at,
    u.username,
    u.display_name,
    u.profile_picture,
    -- Check if current user liked this post
    EXISTS(
        SELECT 1 FROM likes 
        WHERE post_id = p.id AND user_id = 1
    ) as is_liked,
    -- Check if current user saved this post
    EXISTS(
        SELECT 1 FROM saved_posts 
        WHERE post_id = p.id AND user_id = 1
    ) as is_saved
FROM posts p
JOIN users u ON p.user_id = u.id
JOIN followers f ON p.user_id = f.following_id
WHERE f.follower_id = 1 AND f.status = 'accepted'
ORDER BY p.created_at DESC
LIMIT 20;
```

**What this does:**
1. Get posts from users that user 1 follows
2. Include post details and user info
3. Check if user 1 liked each post
4. Check if user 1 saved each post
5. Sort by newest first
6. Limit to 20 posts

#### 3. Get All Comments for a Post with User Info

```sql
SELECT 
    c.id,
    c.content,
    c.created_at,
    u.id as user_id,
    u.username,
    u.display_name,
    u.profile_picture
FROM comments c
JOIN users u ON c.user_id = u.id
WHERE c.post_id = 10
ORDER BY c.created_at ASC;
```

**Result:**
```
+----+------------------+---------------------+---------+----------+--------------+----------------+
| id | content          | created_at          | user_id | username | display_name | profile_picture|
+----+------------------+---------------------+---------+----------+--------------+----------------+
|  1 | Great photo!     | 2024-01-15 10:00:00 |       2 | alice123 | Alice Smith  | alice.jpg      |
|  2 | Love this!       | 2024-01-15 10:05:00 |       3 | bob_2024 | Bob Johnson  | bob.jpg        |
|  3 | Amazing shot!    | 2024-01-15 10:10:00 |       4 | carol99  | Carol White  | carol.jpg      |
+----+------------------+---------------------+---------+----------+--------------+----------------+
```

#### 4. Get Conversation Messages Between Two Users

```sql
SELECT 
    m.id,
    m.sender_id,
    m.receiver_id,
    m.content,
    m.is_read,
    m.created_at,
    u.username as sender_username,
    u.profile_picture as sender_picture
FROM messages m
JOIN users u ON m.sender_id = u.id
WHERE (m.sender_id = 1 AND m.receiver_id = 2)
   OR (m.sender_id = 2 AND m.receiver_id = 1)
ORDER BY m.created_at ASC;
```

**Explanation:**
- Get messages where user 1 sent to user 2
- OR messages where user 2 sent to user 1
- Sort by time (oldest first for chat history)

#### 5. Get User's Notifications with Details

```sql
SELECT 
    n.id,
    n.type,
    n.message,
    n.is_read,
    n.created_at,
    sender.id as sender_id,
    sender.username as sender_username,
    sender.profile_picture as sender_picture,
    p.id as post_id,
    p.image_url as post_image
FROM notifications n
JOIN users sender ON n.sender_id = sender.id
LEFT JOIN posts p ON n.post_id = p.id
WHERE n.user_id = 1
ORDER BY n.created_at DESC
LIMIT 20;
```

**Result:**
```
+----+--------+------------------------+---------+---------------------+---------+---------------+
| id | type   | message                | is_read | created_at          |sender_id|sender_username|
+----+--------+------------------------+---------+---------------------+---------+---------------+
|  5 | like   | alice123 liked ...     | false   | 2024-01-15 14:30:00 |       2 | alice123      |
|  4 | comment| bob_2024 commented ... | true    | 2024-01-15 12:00:00 |       3 | bob_2024      |
|  3 | follow | carol99 followed you   | true    | 2024-01-15 09:00:00 |       4 | carol99       |
+----+--------+------------------------+---------+---------------------+---------+---------------+
```

#### 6. Get User Suggestions (Users Not Following Yet)

```sql
SELECT 
    u.id,
    u.username,
    u.display_name,
    u.profile_picture,
    u.bio,
    COUNT(DISTINCT f.follower_id) as followers_count
FROM users u
LEFT JOIN followers f ON u.id = f.following_id AND f.status = 'accepted'
WHERE u.id != 1  -- Exclude current user
  AND u.id NOT IN (
      -- Exclude users already following
      SELECT following_id FROM followers 
      WHERE follower_id = 1
  )
GROUP BY u.id
ORDER BY followers_count DESC
LIMIT 10;
```

**What this does:**
1. Get all users except current user (id=1)
2. Exclude users that user 1 is already following
3. Count how many followers each user has
4. Sort by most popular (most followers)
5. Suggest top 10

#### 7. Get Popular Posts (Most Liked in Last 7 Days)

```sql
SELECT 
    p.id,
    p.caption,
    p.image_url,
    p.likes_count,
    p.comments_count,
    p.created_at,
    u.username,
    u.profile_picture
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY p.likes_count DESC
LIMIT 10;
```

**Explanation:**
- `DATE_SUB(NOW(), INTERVAL 7 DAY)` = 7 days ago
- Only posts from last 7 days
- Sort by most likes
- Top 10 posts

#### 8. Get User's Activity Summary

```sql
SELECT 
    (SELECT COUNT(*) FROM posts WHERE user_id = 1) as total_posts,
    (SELECT COUNT(*) FROM comments WHERE user_id = 1) as total_comments,
    (SELECT COUNT(*) FROM likes WHERE user_id = 1) as total_likes_given,
    (SELECT COUNT(*) FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.user_id = 1) as total_likes_received,
    (SELECT COUNT(*) FROM followers WHERE following_id = 1 AND status = 'accepted') as followers,
    (SELECT COUNT(*) FROM followers WHERE follower_id = 1 AND status = 'accepted') as following;
```

**Result:**
```
+-------------+----------------+-----------------+---------------------+-----------+-----------+
| total_posts | total_comments | total_likes_given| total_likes_received| followers | following |
+-------------+----------------+-----------------+---------------------+-----------+-----------+
|          45 |            123 |             567 |                1234 |       150 |       200 |
+-------------+----------------+-----------------+---------------------+-----------+-----------+
```

---

## 🎯 Advanced SQL Concepts

### 1. JOINS - Connecting Tables

Joins are how we connect related data from different tables.

#### Types of Joins

**INNER JOIN** - Only matching records
```sql
SELECT p.caption, u.username
FROM posts p
INNER JOIN users u ON p.user_id = u.id;
```

**Visual:**
```
Posts:              Users:              Result:
+----+---------+    +----+----------+   +------------------+----------+
| id | user_id |    | id | username |   | caption          | username |
+----+---------+    +----+----------+   +------------------+----------+
|  1 |       1 | ━━━ |  1 | john     | = | Beautiful!       | john     |
|  2 |       2 | ━━━ |  2 | alice    | = | Great day!       | alice    |
|  3 |       5 | ━━X |  3 | bob      |   +------------------+----------+
+----+---------+    +----+----------+   (Post 3 excluded - user 5 doesn't exist)
```

**LEFT JOIN** - All records from left table + matching from right
```sql
SELECT u.username, p.caption
FROM users u
LEFT JOIN posts p ON u.id = p.user_id;
```

**Visual:**
```
Users:              Posts:              Result:
+----+----------+    +----+---------+   +----------+------------------+
| id | username |    | id | user_id |   | username | caption          |
+----+----------+    +----+---------+   +----------+------------------+
|  1 | john     | ━━━ |  1 |       1 | = | john     | Beautiful!       |
|  2 | alice    | ━━━ |  2 |       2 | = | alice    | Great day!       |
|  3 | bob      | ━━X |  3 |       1 | = | bob      | NULL             |
+----+----------+    +----+---------+   +----------+------------------+
(Bob included even though he has no posts)
```

### 2. Aggregate Functions

**COUNT** - Count rows
```sql
SELECT COUNT(*) FROM users;  -- Total users
SELECT COUNT(*) FROM posts WHERE user_id = 1;  -- User's posts
```

**SUM** - Add up values
```sql
SELECT SUM(likes_count) FROM posts WHERE user_id = 1;  -- Total likes on user's posts
```

**AVG** - Average value
```sql
SELECT AVG(likes_count) FROM posts;  -- Average likes per post
```

**MAX/MIN** - Highest/Lowest value
```sql
SELECT MAX(likes_count) FROM posts;  -- Most liked post's like count
SELECT MIN(created_at) FROM posts WHERE user_id = 1;  -- User's first post date
```

### 3. GROUP BY - Grouping Results

```sql
-- Count posts per user
SELECT user_id, COUNT(*) as post_count
FROM posts
GROUP BY user_id;
```

**Result:**
```
+---------+------------+
| user_id | post_count |
+---------+------------+
|       1 |         15 |
|       2 |         23 |
|       3 |          8 |
+---------+------------+
```

**With HAVING** (filter groups):
```sql
-- Users with more than 10 posts
SELECT user_id, COUNT(*) as post_count
FROM posts
GROUP BY user_id
HAVING COUNT(*) > 10;
```

### 4. Subqueries - Queries Inside Queries

**In SELECT:**
```sql
SELECT 
    username,
    (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count
FROM users u;
```

**In WHERE:**
```sql
-- Get posts by users with more than 100 followers
SELECT * FROM posts
WHERE user_id IN (
    SELECT following_id 
    FROM followers 
    GROUP BY following_id 
    HAVING COUNT(*) > 100
);
```

**In FROM:**
```sql
-- Get average likes per user
SELECT AVG(likes_per_user) as overall_average
FROM (
    SELECT user_id, AVG(likes_count) as likes_per_user
    FROM posts
    GROUP BY user_id
) as user_averages;
```

### 5. Transactions - Multiple Operations Together

Transactions ensure all operations succeed together, or none do:

```sql
START TRANSACTION;

-- Transfer a post from one user to another
UPDATE posts SET user_id = 2 WHERE id = 10;
UPDATE users SET posts_count = posts_count - 1 WHERE id = 1;
UPDATE users SET posts_count = posts_count + 1 WHERE id = 2;

-- If everything worked, save changes
COMMIT;

-- If something failed, undo everything
-- ROLLBACK;
```

**Why?** Imagine if the first UPDATE worked but the second failed. Post would move but counts would be wrong!

---

## ⚡ Performance Optimization

### 1. Indexes - Speed Up Queries

**How Indexes Work:**

Without Index:
```
Find username 'alice' in 1,000,000 users
→ Check row 1: 'john' ❌
→ Check row 2: 'bob' ❌
→ Check row 3: 'carol' ❌
...
→ Check row 567,890: 'alice' ✅  (Found after checking 567,890 rows!)
```

With Index:
```
Find username 'alice' in index
→ Index says: 'alice' is at row 567,890
→ Go directly to row 567,890 ✅  (Found instantly!)
```

**Creating Indexes:**
```sql
-- Index on username for fast lookups
CREATE INDEX idx_username ON users(username);

-- Index on post creation date for sorting
CREATE INDEX idx_created_at ON posts(created_at);

-- Composite index for common query patterns
CREATE INDEX idx_user_created ON posts(user_id, created_at);
```

**When to Use Indexes:**
- ✅ Columns used in WHERE clauses
- ✅ Columns used in JOIN conditions
- ✅ Columns used in ORDER BY
- ❌ Columns rarely searched
- ❌ Columns with few unique values (like boolean)

### 2. Query Optimization Tips

**❌ BAD - Select everything:**
```sql
SELECT * FROM posts WHERE user_id = 1;
```

**✅ GOOD - Select only what you need:**
```sql
SELECT id, caption, image_url FROM posts WHERE user_id = 1;
```

**❌ BAD - Multiple separate queries:**
```sql
SELECT * FROM posts WHERE id = 1;
SELECT * FROM users WHERE id = <user_id_from_post>;
SELECT COUNT(*) FROM likes WHERE post_id = 1;
```

**✅ GOOD - One JOIN query:**
```sql
SELECT 
    p.*,
    u.username,
    u.profile_picture,
    COUNT(l.id) as like_count
FROM posts p
JOIN users u ON p.user_id = u.id
LEFT JOIN likes l ON p.id = l.post_id
WHERE p.id = 1
GROUP BY p.id;
```

### 3. Use EXPLAIN to Analyze Queries

```sql
EXPLAIN SELECT * FROM posts WHERE user_id = 1;
```

This shows how MySQL executes the query and if it uses indexes.

### 4. Pagination - Don't Load Everything at Once

**❌ BAD - Load all posts:**
```sql
SELECT * FROM posts ORDER BY created_at DESC;  -- Could be millions!
```

**✅ GOOD - Load 20 at a time:**
```sql
-- Page 1
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 0;

-- Page 2
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 20;

-- Page 3
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 40;
```

---

## 🔧 Common Operations

### User Registration Flow

```sql
-- 1. Check if username exists
SELECT id FROM users WHERE username = 'newuser';
-- If exists, return error

-- 2. Check if email exists
SELECT id FROM users WHERE email = 'new@email.com';
-- If exists, return error

-- 3. Insert new user
INSERT INTO users (username, email, password, display_name)
VALUES ('newuser', 'new@email.com', '$hashed_password', 'New User');

-- 4. Get the new user's ID
SELECT LAST_INSERT_ID();
```

### User Login Flow

```sql
-- 1. Get user by username or email
SELECT id, username, password FROM users 
WHERE username = 'john_doe' OR email = 'john_doe';

-- 2. Verify password (done in application code)
-- bcrypt.compare(input_password, stored_password)

-- 3. If valid, generate JWT token (in application)
```

### Creating a Post

```sql
-- 1. Insert post
INSERT INTO posts (user_id, caption, image_url, hashtags)
VALUES (1, 'Beautiful day! #sunshine', 'img.jpg', '["sunshine"]');

-- 2. Get the new post ID
SET @post_id = LAST_INSERT_ID();

-- 3. Notify followers
INSERT INTO notifications (user_id, type, sender_id, post_id, message)
SELECT 
    follower_id,
    'post',
    1,
    @post_id,
    'john_doe posted a new photo'
FROM followers
WHERE following_id = 1 AND status = 'accepted';
```

### Liking a Post

```sql
START TRANSACTION;

-- 1. Add like
INSERT INTO likes (user_id, post_id)
VALUES (2, 10);

-- 2. Increment like counter
UPDATE posts SET likes_count = likes_count + 1 WHERE id = 10;

-- 3. Create notification
INSERT INTO notifications (user_id, type, sender_id, post_id, message)
SELECT 
    p.user_id,
    'like',
    2,
    10,
    CONCAT(u.username, ' liked your post')
FROM posts p
JOIN users u ON u.id = 2
WHERE p.id = 10;

COMMIT;
```

### Following a User

```sql
-- 1. Check if already following
SELECT id, status FROM followers 
WHERE follower_id = 1 AND following_id = 2;

-- 2. If not following, create follow request
INSERT INTO followers (follower_id, following_id, status)
VALUES (1, 2, 'pending');  -- or 'accepted' for public accounts

-- 3. Create notification
INSERT INTO notifications (user_id, type, sender_id, message)
VALUES (2, 'follow_request', 1, 'john_doe wants to follow you');
```

### Accepting Follow Request

```sql
START TRANSACTION;

-- 1. Update follow status
UPDATE followers 
SET status = 'accepted' 
WHERE id = 5;

-- 2. Notify requester
INSERT INTO notifications (user_id, type, sender_id, message)
SELECT 
    follower_id,
    'follow_accepted',
    following_id,
    CONCAT(u.username, ' accepted your follow request')
FROM followers f
JOIN users u ON u.id = f.following_id
WHERE f.id = 5;

COMMIT;
```

### Sending a Message

```sql
-- 1. Insert message
INSERT INTO messages (sender_id, receiver_id, content)
VALUES (1, 2, 'Hello, how are you?');

-- 2. Create notification (if recipient not online)
INSERT INTO notifications (user_id, type, sender_id, message)
VALUES (2, 'message', 1, 'john_doe sent you a message');
```

### Creating a Story

```sql
-- 1. Insert story
INSERT INTO stories (user_id, image_url, expires_at)
VALUES (1, 'story.jpg', DATE_ADD(NOW(), INTERVAL 24 HOUR));

-- 2. Notify followers
INSERT INTO notifications (user_id, type, sender_id, message)
SELECT 
    follower_id,
    'story',
    1,
    'john_doe posted a new story'
FROM followers
WHERE following_id = 1 AND status = 'accepted';
```

### Cleanup Expired Stories (Run Periodically)

```sql
-- Delete stories older than 24 hours
DELETE FROM stories WHERE expires_at < NOW();
```

---

## 🐛 Troubleshooting

### Common Errors and Solutions

#### Error: "Duplicate entry for key 'unique_like'"
```
Cause: User already liked this post
Solution: Check if like exists before inserting

SELECT id FROM likes WHERE user_id = 1 AND post_id = 10;
-- If exists, user already liked it
```

#### Error: "Cannot add or update a child row: foreign key constraint fails"
```
Cause: Trying to reference a non-existent ID
Example: Creating post with user_id = 999, but user 999 doesn't exist

Solution: Verify foreign key exists:
SELECT id FROM users WHERE id = 999;
```

#### Error: "Data too long for column 'username'"
```
Cause: Text exceeds VARCHAR limit
Solution: Check length before insert:

-- username is VARCHAR(50)
SELECT LENGTH('very_long_username_that_exceeds_fifty_characters');
-- If > 50, truncate or reject
```

#### Slow Queries
```
Problem: Query takes too long
Solution: 
1. Use EXPLAIN to check if indexes are used
2. Add indexes on frequently searched columns
3. Reduce data fetched with LIMIT
4. Optimize JOINs
```

### Useful Debugging Queries

**Check table structure:**
```sql
DESCRIBE users;
SHOW CREATE TABLE users;
```

**Check all tables:**
```sql
SHOW TABLES;
```

**Check indexes:**
```sql
SHOW INDEX FROM posts;
```

**Check table size:**
```sql
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.TABLES
WHERE table_schema = 'socialconnect'
ORDER BY size_mb DESC;
```

**Count all records:**
```sql
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'posts', COUNT(*) FROM posts
UNION ALL
SELECT 'comments', COUNT(*) FROM comments
UNION ALL
SELECT 'likes', COUNT(*) FROM likes;
```

---

## 📊 Database Maintenance

### Regular Maintenance Tasks

**1. Backup Database**
```bash
# Full backup
mysqldump -u root -p socialconnect > backup_$(date +%Y%m%d).sql

# Backup specific tables
mysqldump -u root -p socialconnect users posts > backup_users_posts.sql
```

**2. Restore Database**
```bash
mysql -u root -p socialconnect < backup_20240115.sql
```

**3. Optimize Tables**
```sql
OPTIMIZE TABLE posts;
OPTIMIZE TABLE users;
```

**4. Check Table Integrity**
```sql
CHECK TABLE posts;
CHECK TABLE users;
```

**5. Repair Tables (if corrupted)**
```sql
REPAIR TABLE posts;
```

### Performance Monitoring

**Check slow queries:**
```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;  -- Queries taking > 2 seconds
```

**Monitor connections:**
```sql
SHOW PROCESSLIST;
```

**Check database size:**
```sql
SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'socialconnect'
GROUP BY table_schema;
```

---

## 🎓 Learning Resources

### Practice Queries

Try these on your own database:

1. Find all users who joined in the last 7 days
2. Get the 5 most liked posts of all time
3. Find users who have never posted
4. Count how many comments each user has made
5. Find posts with more than 10 comments
6. Get users who follow each other (mutual follows)
7. Find the most active users (most posts + comments + likes)
8. Get posts created on weekends
9. Find hashtags used more than 5 times
10. Get users with no followers

### SQL Learning Path

1. **Basic SELECT** - Retrieve data
2. **WHERE clauses** - Filter data
3. **ORDER BY and LIMIT** - Sort and paginate
4. **Aggregate Functions** - COUNT, SUM, AVG, etc.
5. **GROUP BY** - Group results
6. **JOINS** - Connect tables
7. **Subqueries** - Nested queries
8. **Indexes** - Optimize performance
9. **Transactions** - Multiple operations
10. **Advanced Topics** - Views, stored procedures, triggers

---

## 📝 Summary

This guide covered:
- ✅ What databases and SQL are
- ✅ Complete SocialConnect database schema
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Advanced queries with JOINs and subqueries
- ✅ Performance optimization with indexes
- ✅ Common operations and flows
- ✅ Troubleshooting and maintenance
- ✅ Best practices

**Key Takeaways:**
1. **Tables** store data in rows and columns
2. **Primary Keys** uniquely identify records
3. **Foreign Keys** create relationships between tables
4. **Indexes** make queries faster
5. **JOINs** connect related data
6. **Transactions** ensure data integrity
7. **Always backup** your database!

---

**Happy Learning! 🚀**

