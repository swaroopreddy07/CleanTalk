const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  console.log('🚀 Running v3 feature migration...\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'socialconnect',
      multipleStatements: true,
    });

    console.log('✅ Connected to database\n');

    // 1. Reactions table
    console.log('📦 Creating reactions table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        type VARCHAR(10) NOT NULL DEFAULT '❤️',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_reaction (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_post_id (post_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ reactions table created');

    // 2. Reports table
    console.log('📦 Creating reports table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reporter_id INT NOT NULL,
        reported_user_id INT DEFAULT NULL,
        reported_post_id INT DEFAULT NULL,
        reported_comment_id INT DEFAULT NULL,
        reason VARCHAR(50) NOT NULL DEFAULT 'other',
        description TEXT DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_reporter (reporter_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ reports table created');

    // 3. Blocked users table
    console.log('📦 Creating blocked_users table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        blocker_id INT NOT NULL,
        blocked_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_block (blocker_id, blocked_id),
        FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_blocker (blocker_id),
        INDEX idx_blocked (blocked_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ blocked_users table created');

    // 4. User privacy/theme columns
    console.log('📦 Adding user privacy columns...');
    const userCols = [
      { name: 'is_private', sql: "ALTER TABLE users ADD COLUMN is_private BOOLEAN DEFAULT TRUE" },
      { name: 'message_privacy', sql: "ALTER TABLE users ADD COLUMN message_privacy VARCHAR(20) DEFAULT 'everyone'" },
      { name: 'theme', sql: "ALTER TABLE users ADD COLUMN theme VARCHAR(10) DEFAULT 'dark'" },
    ];
    for (const col of userCols) {
      try {
        await connection.query(col.sql);
        console.log(`  ✅ users.${col.name} added`);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log(`  ⏭️  users.${col.name} already exists`);
        else throw e;
      }
    }

    // 5. Message delivery/read columns
    console.log('📦 Adding message delivery columns...');
    const msgCols = [
      { name: 'is_delivered', sql: "ALTER TABLE messages ADD COLUMN is_delivered BOOLEAN DEFAULT FALSE" },
      { name: 'read_at', sql: "ALTER TABLE messages ADD COLUMN read_at DATETIME DEFAULT NULL" },
    ];
    for (const col of msgCols) {
      try {
        await connection.query(col.sql);
        console.log(`  ✅ messages.${col.name} added`);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log(`  ⏭️  messages.${col.name} already exists`);
        else throw e;
      }
    }

    // Verify
    console.log('\n📊 Verifying migration...');
    const tables = ['reactions', 'reports', 'blocked_users'];
    for (const t of tables) {
      const [rows] = await connection.query(`SHOW TABLES LIKE '${t}'`);
      console.log(`  ${rows.length > 0 ? '✅' : '❌'} ${t}`);
    }

    console.log('\n═══════════════════════════════════════');
    console.log('✅ v3 feature migration complete!');
    console.log('═══════════════════════════════════════\n');

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

migrate();
