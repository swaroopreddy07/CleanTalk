/**
 * Image Utility Functions
 * 
 * This module provides utility functions for handling image URLs
 * across the application, ensuring consistent image URL construction
 * and error handling.
 */

/**
 * Constructs a full image URL from a relative path or returns the URL as-is if it's already absolute
 * @param {string|null|undefined} imageUrl - The image URL (can be relative or absolute)
 * @param {string} baseUrl - The base API URL (defaults to process.env.REACT_APP_API_URL)
 * @returns {string} - The complete image URL or empty string if no URL provided
 */
export const getImageUrl = (imageUrl, baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000') => {
  if (!imageUrl) return '';
  
  // If it's already a full URL (starts with http), return as-is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // Strip '/api' suffix from base URL for file paths (uploads, etc.)
  // Files are served at the root (e.g., /uploads/), not under /api/
  const fileBaseUrl = baseUrl.replace(/\/api\/?$/, '');
  
  // Otherwise, construct the full URL
  return `${fileBaseUrl}${imageUrl}`;
};

/**
 * Handles image load errors with consistent logging
 * @param {Event} event - The error event
 * @param {string} imageUrl - The original image URL
 * @param {string} context - Context for logging (e.g., 'Profile post image', 'Story image')
 */
export const handleImageError = (event, imageUrl, context = 'Image') => {
  console.error(`❌ ${context} failed to load:`, imageUrl);
  console.error(`❌ Full URL attempted:`, getImageUrl(imageUrl));
  
  // Hide the broken image
  event.target.style.display = 'none';
};

/**
 * Handles successful image loads with consistent logging
 * @param {string} imageUrl - The image URL that loaded successfully
 * @param {string} context - Context for logging (e.g., 'Profile post image', 'Story image')
 */
export const handleImageLoad = (imageUrl, context = 'Image') => {
  console.log(`✅ ${context} loaded successfully:`, imageUrl);
};

/**
 * Gets fallback image URL for different contexts
 * @param {string} type - Type of fallback image ('avatar', 'post', 'story')
 * @returns {string} - Fallback image URL
 */
export const getFallbackImageUrl = (type = 'avatar') => {
  const fallbackImages = {
    avatar: '/default-avatar.png',
    post: '/default-post.png',
    story: '/default-story.png'
  };
  
  return fallbackImages[type] || fallbackImages.avatar;
};

/**
 * Creates image error and load handlers for a specific context
 * @param {string} context - Context for logging
 * @param {string} fallbackType - Type of fallback image
 * @returns {Object} - Object with onError and onLoad handlers
 */
export const createImageHandlers = (context, fallbackType = 'avatar') => {
  return {
    onError: (event) => handleImageError(event, '', context),
    onLoad: () => handleImageLoad('', context)
  };
};

/**
 * Creates image error and load handlers for a specific image URL and context
 * @param {string} imageUrl - The image URL
 * @param {string} context - Context for logging
 * @param {string} fallbackType - Type of fallback image
 * @returns {Object} - Object with onError and onLoad handlers
 */
export const createImageHandlersForUrl = (imageUrl, context, fallbackType = 'avatar') => {
  return {
    onError: (event) => handleImageError(event, imageUrl, context),
    onLoad: () => handleImageLoad(imageUrl, context)
  };
};

/**
 * Get the API URL from environment variables
 * @returns {string} The API base URL
 */
export const getApiUrl = () => {
  return process.env.REACT_APP_API_URL || 'http://localhost:5000';
};
