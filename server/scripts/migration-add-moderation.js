/**
 * Migration Script: Add Moderation Logs Table
 * 
 * Creates the moderation_logs table for storing AI moderation events.
 * This script is safe to run multiple times (idempotent).
 * 
 * Usage:
 *   node scripts/migration-add-moderation.js
 * 
 * @author SocialConnect Team
 * @version 1.0.0
 */

const db = require('../config/db');

async function migrate() {
  console.log('🚀 Starting moderation_logs migration...\n');

  try {
    // Create the moderation_logs table
    console.log('📋 Creating moderation_logs table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS moderation_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        post_id INT,
        content TEXT NOT NULL,
        content_type ENUM('comment', 'caption') NOT NULL,
        prediction VARCHAR(50) NOT NULL,
        confidence DECIMAL(5,4) NOT NULL,
        labels JSON,
        action_taken ENUM('blocked', 'warned', 'force_posted') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL,
        INDEX idx_moderation_user_id (user_id),
        INDEX idx_moderation_content_type (content_type),
        INDEX idx_moderation_action_taken (action_taken),
        INDEX idx_moderation_created_at (created_at),
        INDEX idx_moderation_prediction (prediction)
      )
    `);
    console.log('✅ moderation_logs table created successfully\n');

    // Verify the table was created
    const [tables] = await db.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'socialconnect' AND TABLE_NAME = 'moderation_logs'"
    );

    if (tables.length > 0) {
      console.log('✅ Verification: moderation_logs table exists');
    } else {
      console.log('❌ Verification failed: moderation_logs table not found');
    }

    // Show table structure
    const [columns] = await db.execute('DESCRIBE moderation_logs');
    console.log('\n📊 Table structure:');
    console.table(columns.map(col => ({
      Field: col.Field,
      Type: col.Type,
      Null: col.Null,
      Key: col.Key,
      Default: col.Default,
    })));

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
