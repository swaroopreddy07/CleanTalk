const { initializeDatabase, getSampleDataSQL } = require('../models/db');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
  console.log('Starting database setup...\n');

  // Step 1: Initialize database and create tables
  const initialized = await initializeDatabase();
  
  if (!initialized) {
    console.error('Failed to initialize database');
    process.exit(1);
  }

  // Step 2: Insert sample data (optional)
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('\nDo you want to insert sample data? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      try {
        const connection = await mysql.createConnection({
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          database: 'socialconnect',
          multipleStatements: true
        });

        await connection.query(getSampleDataSQL());
        console.log('Sample data inserted successfully');
        await connection.end();
      } catch (error) {
        console.error('Error inserting sample data:', error.message);
      }
    }

    console.log('\n✅ Database setup complete!');
    console.log('\nYou can now start the server with: npm start\n');
    readline.close();
    process.exit(0);
  });
}

setupDatabase();