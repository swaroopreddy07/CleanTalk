const db = require('../config/db');

async function fixFollowersTable() {
  try {
    console.log('🔍 Checking followers table structure...');
    
    // Check if status column exists
    const [columns] = await db.execute("SHOW COLUMNS FROM followers LIKE 'status'");
    
    if (columns.length === 0) {
      console.log('⚠️ Status column not found. Adding it...');
      
      // Add status column
      await db.execute(`
        ALTER TABLE followers 
        ADD COLUMN status ENUM('pending', 'accepted', 'rejected') DEFAULT 'accepted'
      `);
      
      // Update existing records to have 'accepted' status
      await db.execute(`
        UPDATE followers 
        SET status = 'accepted' 
        WHERE status IS NULL
      `);
      
      console.log('✅ Status column added successfully!');
    } else {
      console.log('✅ Status column already exists.');
    }
    
    // Show current table structure
    const [tableStructure] = await db.execute("DESCRIBE followers");
    console.log('📋 Current followers table structure:');
    console.table(tableStructure);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing followers table:', error);
    process.exit(1);
  }
}

fixFollowersTable();
