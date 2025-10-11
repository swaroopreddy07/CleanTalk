const fs = require('fs');
const path = require('path');
const { uploadToAzure, CONTAINERS } = require('../services/azureStorage');
const db = require('../config/db');
require('dotenv').config();

async function migrateLocalToAzure() {
  console.log('🚀 Starting migration to Azure Storage...\n');

  try {
    // Migrate profile pictures
    console.log('📸 Migrating profile pictures...');
    await migrateFolder(
      path.join(__dirname, '../uploads/profiles'),
      CONTAINERS.PROFILES,
      'profile_picture',
      'users'
    );

    // Migrate post images
    console.log('📷 Migrating post images...');
    await migrateFolder(
      path.join(__dirname, '../uploads/posts'),
      CONTAINERS.POSTS,
      'image_url',
      'posts'
    );

    // Migrate story images
    console.log('📖 Migrating story images...');
    await migrateFolder(
      path.join(__dirname, '../uploads/stories'),
      CONTAINERS.STORIES,
      'image_url',
      'stories'
    );

    console.log('\n✅ Migration complete!');
    console.log('You can now delete the local uploads folder if you want.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

async function migrateFolder(localPath, containerName, columnName, tableName) {
  if (!fs.existsSync(localPath)) {
    console.log(`📁 Folder not found: ${localPath}`);
    return;
  }

  const files = fs.readdirSync(localPath);
  console.log(`📋 Found ${files.length} files to migrate\n`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(localPath, file);
    
    try {
      // Read file
      const fileBuffer = fs.readFileSync(filePath);
      
      // Upload to Azure
      console.log(`[${i + 1}/${files.length}] ⬆️  Uploading ${file}...`);
      const azureUrl = await uploadToAzure(fileBuffer, file, containerName);
      
      // Update database
      const localUrl = `/uploads/${containerName.replace('-pictures', '').replace('-images', '')}/${file}`;
      const [result] = await db.execute(
        `UPDATE ${tableName} SET ${columnName} = ? WHERE ${columnName} = ?`,
        [azureUrl, localUrl]
      );
      
      if (result.affectedRows > 0) {
        console.log(`✅ Migrated: ${file} (${result.affectedRows} rows updated)`);
      } else {
        console.log(`⚠️  No database records found for: ${file}`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate ${file}:`, error.message);
    }
  }
  
  console.log('');
}

// Test Azure connection before migration
async function testAzureConnection() {
  try {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    
    console.log('🔗 Testing Azure connection...');
    const containerClient = blobServiceClient.getContainerClient(CONTAINERS.PROFILES);
    await containerClient.createIfNotExists();
    console.log('✅ Azure Storage connected successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Azure connection failed:', error.message);
    console.log('Please check your AZURE_STORAGE_CONNECTION_STRING in .env file\n');
    return false;
  }
}

// Main execution
async function main() {
  console.log('='.repeat(50));
  console.log('☁️  AZURE STORAGE MIGRATION TOOL');
  console.log('='.repeat(50));
  
  // Check if Azure connection string is set
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    console.error('❌ AZURE_STORAGE_CONNECTION_STRING not found in .env file');
    console.log('Please add your Azure Storage connection string to .env file');
    process.exit(1);
  }

  // Test connection
  const connected = await testAzureConnection();
  if (!connected) {
    process.exit(1);
  }

  // Start migration
  await migrateLocalToAzure();
}

// Run migration
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { migrateLocalToAzure, migrateFolder };
