const { createPresignedPutUrl } = require('./storage');

/**
 * Generate presigned URL for any file type
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type of the file
 * @param {string} uploadType - Type of upload (profiles, categories, batches, etc.)
 * @param {number} expiresIn - Expiration time in seconds (default: 600)
 * @returns {Promise<Object>} - { uploadUrl, key, publicUrl }
 */
const generatePresignedUrl = async (filename, mimeType, uploadType = 'general', expiresIn = 600) => {
  try {
    if (!filename || !mimeType) {
      throw new Error('filename and mimeType are required');
    }

    const path = require('path');
    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const randomId = Math.round(Math.random() * 1e9);
    
    const key = `public/uploads/${uploadType}/${timestamp}-${randomId}-${safeName}`;
    const { uploadUrl, publicUrl } = await createPresignedPutUrl(key, mimeType, expiresIn);
    
    return { uploadUrl, key, publicUrl };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
};

module.exports = {
  generatePresignedUrl
};
