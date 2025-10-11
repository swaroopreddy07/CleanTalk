const { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Initialize Azure Blob Service Client
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
let blobServiceClient = null;
let sharedKeyCredential = null;

// Only initialize if connection string is provided
if (connectionString && connectionString !== 'DefaultEndpointsProtocol=https;AccountName=your_account_name;AccountKey=your_account_key;EndpointSuffix=core.windows.net') {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    
    // Extract credentials for SAS token generation
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = connectionString.match(/AccountKey=([^;]+)/)?.[1];
    if (accountName && accountKey) {
      sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    }
  } catch (error) {
    console.warn('⚠️ Azure Storage connection string is invalid. Azure features will be disabled.');
    console.warn('Please check your AZURE_STORAGE_CONNECTION_STRING in .env file');
  }
} else {
  console.warn('⚠️ Azure Storage not configured. Please set AZURE_STORAGE_CONNECTION_STRING in .env file');
  console.warn('📖 See AZURE_SETUP_GUIDE.md for setup instructions');
}

// Container names
const CONTAINERS = {
  PROFILES: process.env.AZURE_CONTAINER_PROFILES || 'profile-pictures',
  POSTS: process.env.AZURE_CONTAINER_POSTS || 'post-images',
  STORIES: process.env.AZURE_CONTAINER_STORIES || 'story-images',
};

/**
 * Upload file to Azure Blob Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original filename
 * @param {string} containerName - Container name
 * @returns {Promise<string>} - URL of uploaded file
 */
async function uploadToAzure(fileBuffer, fileName, containerName) {
  if (!blobServiceClient) {
    throw new Error('Azure Storage not configured. Please set up your Azure Storage account.');
  }

  try {
    // Generate unique filename
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;

    // Get container client
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Ensure container exists
    await containerClient.createIfNotExists({
      access: 'blob', // 'blob' for public read access, 'container' for full public access
    });

    // Get block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(uniqueFileName);

    // Determine content type
    const contentType = getContentType(fileExtension);

    // Upload file
    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });

    // Return SAS URL for secure access (now that CORS is configured)
    return generateSasUrl(uniqueFileName, containerName);
  } catch (error) {
    console.error('Azure upload error:', error);
    throw new Error('Failed to upload file to Azure');
  }
}

/**
 * Delete file from Azure Blob Storage
 * @param {string} fileUrl - Full URL of the file to delete
 * @param {string} containerName - Container name
 * @returns {Promise<boolean>} - Success status
 */
async function deleteFromAzure(fileUrl, containerName) {
  if (!blobServiceClient) {
    console.warn('Azure Storage not configured. Cannot delete file:', fileUrl);
    return false;
  }

  try {
    // Extract blob name from URL
    const blobName = fileUrl.split('/').pop().split('?')[0];

    // Get container client
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Get block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Delete blob
    await blockBlobClient.deleteIfExists();

    return true;
  } catch (error) {
    console.error('Azure delete error:', error);
    return false;
  }
}

/**
 * Generate SAS URL for blob access
 * @param {string} blobName - Name of the blob
 * @param {string} containerName - Name of the container
 * @returns {string} - SAS URL
 */
function generateSasUrl(blobName, containerName) {
  if (!sharedKeyCredential) {
    throw new Error('Shared key credential not available for SAS generation');
  }

  const sasOptions = {
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse('r'), // read only
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 24 * 60 * 60 * 1000), // 24 hours
  };

  const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  
  return `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
}

/**
 * Get content type based on file extension
 * @param {string} extension - File extension
 * @returns {string} - MIME type
 */
function getContentType(extension) {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };

  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Upload profile picture
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original filename
 * @returns {Promise<string>} - URL of uploaded file
 */
async function uploadProfilePicture(fileBuffer, fileName) {
  return uploadToAzure(fileBuffer, fileName, CONTAINERS.PROFILES);
}

/**
 * Upload post image
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original filename
 * @returns {Promise<string>} - URL of uploaded file
 */
async function uploadPostImage(fileBuffer, fileName) {
  return uploadToAzure(fileBuffer, fileName, CONTAINERS.POSTS);
}

/**
 * Upload story image
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original filename
 * @returns {Promise<string>} - URL of uploaded file
 */
async function uploadStoryImage(fileBuffer, fileName) {
  return uploadToAzure(fileBuffer, fileName, CONTAINERS.STORIES);
}

/**
 * Delete profile picture
 * @param {string} fileUrl - Full URL of the file
 * @returns {Promise<boolean>} - Success status
 */
async function deleteProfilePicture(fileUrl) {
  return deleteFromAzure(fileUrl, CONTAINERS.PROFILES);
}

/**
 * Delete post image
 * @param {string} fileUrl - Full URL of the file
 * @returns {Promise<boolean>} - Success status
 */
async function deletePostImage(fileUrl) {
  return deleteFromAzure(fileUrl, CONTAINERS.POSTS);
}

/**
 * Delete story image
 * @param {string} fileUrl - Full URL of the file
 * @returns {Promise<boolean>} - Success status
 */
async function deleteStoryImage(fileUrl) {
  return deleteFromAzure(fileUrl, CONTAINERS.STORIES);
}

module.exports = {
  uploadToAzure,
  deleteFromAzure,
  uploadProfilePicture,
  uploadPostImage,
  uploadStoryImage,
  deleteProfilePicture,
  deletePostImage,
  deleteStoryImage,
  CONTAINERS,
};
