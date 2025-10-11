const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

async function configureCORS() {
  console.log('🔧 Configuring CORS for Azure Storage...\n');

  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

    // CORS rules for allowing frontend access
    const corsRules = [
      {
        allowedOrigins: ['http://localhost:3000', 'https://localhost:3000'],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
        allowedHeaders: ['*'],
        exposedHeaders: ['*'],
        maxAgeInSeconds: 3600
      }
    ];

    console.log('📋 CORS Rules to apply:');
    corsRules.forEach((rule, index) => {
      console.log(`Rule ${index + 1}:`);
      console.log(`  Allowed Origins: ${rule.allowedOrigins.join(', ')}`);
      console.log(`  Allowed Methods: ${rule.allowedMethods.join(', ')}`);
      console.log(`  Max Age: ${rule.maxAgeInSeconds} seconds`);
    });

    // Apply CORS rules
    console.log('\n🔄 Applying CORS rules...');
    await blobServiceClient.setProperties({
      cors: corsRules
    });

    console.log('✅ CORS configuration applied successfully!');
    console.log('\n📝 Note: CORS changes may take a few minutes to take effect.');

  } catch (error) {
    console.error('❌ Error configuring CORS:', error.message);
    console.log('\n🔧 Manual CORS Configuration:');
    console.log('1. Go to Azure Portal → Your Storage Account');
    console.log('2. Go to "Resource sharing (CORS)" under Settings');
    console.log('3. Add CORS rule:');
    console.log('   - Allowed origins: http://localhost:3000');
    console.log('   - Allowed methods: GET, POST, PUT, DELETE, HEAD, OPTIONS');
    console.log('   - Allowed headers: *');
    console.log('   - Exposed headers: *');
    console.log('   - Max age: 3600');
    console.log('4. Save the configuration');
  }
}

configureCORS();
