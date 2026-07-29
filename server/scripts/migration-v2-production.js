/**
 * Migration v2.0 — Production Architecture
 * 
 * Changes:
 *   1. Add 'status' column to comments table
 *   2. Add 'moderation_status' column to posts table
 *   3. Create worker_logs table
 *   4. Create queue_metrics table
 *   5. Set existing comments to 'approved' (backward compat)
 *   6. Set existing posts to 'approved' (backward compat)
 *
 * Usage: node scripts/migration-v2-production.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  console.log('🔄 Starting v2.0 Production Migration...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'socialconnect',
  });

  try {
    // =============================================
    // Migration 1: Add status column to comments
    // =============================================
    console.log('📋 Migration 1: Adding status column to comments...');
    try {
      await connection.execute(`
        ALTER TABLE comments 
        ADD COLUMN status ENUM('pending', 'approved', 'warned', 'blocked') 
        DEFAULT 'approved' 
        AFTER content
      `);
      console.log('   ✅ status column added to comments');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('   ⏭️  status column already exists in comments');
      } else {
        throw error;
      }
    }

    // Add index on status
    try {
      await connection.execute('CREATE INDEX idx_comment_status ON comments(status)');
      console.log('   ✅ Index idx_comment_status created');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ⏭️  Index already exists');
      }
    }

    // Set all existing comments to 'approved'
    const [updateResult] = await connection.execute(
      "UPDATE comments SET status = 'approved' WHERE status IS NULL"
    );
    console.log(`   ✅ ${updateResult.affectedRows} existing comments set to 'approved'`);

    // =============================================
    // Migration 2: Add moderation_status to posts
    // =============================================
    console.log('\n📋 Migration 2: Adding moderation_status column to posts...');
    try {
      await connection.execute(`
        ALTER TABLE posts 
        ADD COLUMN moderation_status ENUM('pending', 'approved', 'warned', 'blocked') 
        DEFAULT 'approved' 
        AFTER caption
      `);
      console.log('   ✅ moderation_status column added to posts');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('   ⏭️  moderation_status column already exists in posts');
      } else {
        throw error;
      }
    }

    // Set all existing posts to 'approved'
    const [postUpdate] = await connection.execute(
      "UPDATE posts SET moderation_status = 'approved' WHERE moderation_status IS NULL"
    );
    console.log(`   ✅ ${postUpdate.affectedRows} existing posts set to 'approved'`);

    // =============================================
    // Migration 3: Create worker_logs table
    // =============================================
    console.log('\n📋 Migration 3: Creating worker_logs table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS worker_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        worker_id VARCHAR(50) NOT NULL,
        job_id VARCHAR(100) NOT NULL,
        comment_id INT,
        content_type VARCHAR(20) DEFAULT 'comment',
        action VARCHAR(20),
        toxicity_score DECIMAL(5,4),
        processing_time_ms INT,
        status ENUM('completed', 'failed', 'retried', 'dlq') NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_worker_id (worker_id),
        INDEX idx_job_id (job_id),
        INDEX idx_worker_status (status),
        INDEX idx_worker_created (created_at)
      )
    `);
    console.log('   ✅ worker_logs table created');

    // =============================================
    // Migration 4: Create queue_metrics table
    // =============================================
    console.log('\n📋 Migration 4: Creating queue_metrics table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS queue_metrics (
        id INT PRIMARY KEY AUTO_INCREMENT,
        metric_name VARCHAR(100) NOT NULL,
        metric_value DECIMAL(10,4) NOT NULL,
        metadata JSON,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_metric_name (metric_name),
        INDEX idx_recorded_at (recorded_at)
      )
    `);
    console.log('   ✅ queue_metrics table created');

    // =============================================
    // Migration 5: Add force_posted to moderation action_taken enum
    // =============================================
    console.log('\n📋 Migration 5: Updating moderation_logs action_taken enum...');
    try {
      await connection.execute(`
        ALTER TABLE moderation_logs 
        MODIFY COLUMN action_taken ENUM('blocked', 'warned', 'force_posted', 'approved') NOT NULL
      `);
      console.log('   ✅ action_taken enum updated to include approved');
    } catch (error) {
      console.log('   ⏭️  action_taken enum already up to date');
    }

    // =============================================
    // Verify
    // =============================================
    console.log('\n📊 Verifying migration...');
    
    const [commentCols] = await connection.execute("SHOW COLUMNS FROM comments LIKE 'status'");
    console.log(`   comments.status: ${commentCols.length > 0 ? '✅' : '❌'}`);
    
    const [postCols] = await connection.execute("SHOW COLUMNS FROM posts LIKE 'moderation_status'");
    console.log(`   posts.moderation_status: ${postCols.length > 0 ? '✅' : '❌'}`);
    
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('worker_logs', 'queue_metrics')",
      [process.env.DB_NAME || 'socialconnect']
    );
    const tableNames = tables.map(t => t.TABLE_NAME);
    console.log(`   worker_logs: ${tableNames.includes('worker_logs') ? '✅' : '❌'}`);
    console.log(`   queue_metrics: ${tableNames.includes('queue_metrics') ? '✅' : '❌'}`);

    console.log('\n✅ Migration v2.0 completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
