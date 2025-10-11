const mysql = require('mysql2/promise');
require('dotenv').config();

async function clearDummyData() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'socialconnect'
    });

    console.log('Connected to database');

    // First, let's see what users we have
    console.log('Current users:');
    const [users] = await connection.execute('SELECT id, username, email FROM users');
    users.forEach(u => console.log(`ID: ${u.id}, Username: ${u.username}, Email: ${u.email}`));

    console.log('\nClearing all dummy data...');

    // Clear related data first (due to foreign key constraints)
    console.log('Clearing related data...');
    
    // Clear notifications
    await connection.execute('DELETE FROM notifications');
    console.log('✅ Cleared notifications');

    // Clear messages
    await connection.execute('DELETE FROM messages');
    console.log('✅ Cleared messages');

    // Clear likes
    await connection.execute('DELETE FROM likes');
    console.log('✅ Cleared likes');

    // Clear comments
    await connection.execute('DELETE FROM comments');
    console.log('✅ Cleared comments');

    // Clear saved posts
    await connection.execute('DELETE FROM saved_posts');
    console.log('✅ Cleared saved posts');

    // Clear followers
    await connection.execute('DELETE FROM followers');
    console.log('✅ Cleared followers');

    // Clear stories
    await connection.execute('DELETE FROM stories');
    console.log('✅ Cleared stories');

    // Clear posts
    await connection.execute('DELETE FROM posts');
    console.log('✅ Cleared posts');


    // Finally, clear all users
    await connection.execute('DELETE FROM users');
    console.log('✅ Cleared all users');

    // Verify the cleanup
    console.log('\nVerifying cleanup...');
    const [remainingUsers] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const [remainingPosts] = await connection.execute('SELECT COUNT(*) as count FROM posts');
    const [remainingLikes] = await connection.execute('SELECT COUNT(*) as count FROM likes');
    
    console.log(`Remaining users: ${remainingUsers[0].count}`);
    console.log(`Remaining posts: ${remainingPosts[0].count}`);
    console.log(`Remaining likes: ${remainingLikes[0].count}`);

    await connection.end();
    console.log('\n✅ Database cleanup completed successfully!');
    console.log('You can now register new users through the application.');
    
  } catch (error) {
    console.error('❌ Database cleanup failed:', error.message);
    process.exit(1);
  }
}

clearDummyData();
