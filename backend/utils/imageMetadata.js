const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Extract metadata from an image file
 * @param {string} imagePath - Path to the image file
 * @returns {Object} Image metadata object
 */
const extractImageMetadata = async (imagePath) => {
  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Get file stats for file size
    const stats = fs.statSync(imagePath);
    const fileSize = stats.size;

    // Extract metadata using sharp
    const metadata = await sharp(imagePath).metadata();

    // Calculate aspect ratio
    const aspectRatio = metadata.width && metadata.height 
      ? metadata.width / metadata.height 
      : null;

    // Determine if image has alpha channel
    const hasAlpha = metadata.hasAlpha || false;

    // Extract format from metadata or file extension
    let format = metadata.format;
    if (!format) {
      const ext = path.extname(imagePath).toLowerCase();
      format = ext.replace('.', '');
    }

    // Convert format to uppercase for consistency
    format = format.toUpperCase();

    return {
      width: metadata.width || null,
      height: metadata.height || null,
      fileSize: fileSize,
      format: format,
      aspectRatio: aspectRatio,
      colorSpace: metadata.space || null,
      hasAlpha: hasAlpha,
      density: metadata.density || null,
      channels: metadata.channels || null,
      depth: metadata.depth || null,
    };
  } catch (error) {
    console.error('Error extracting image metadata:', error);
    throw new Error(`Failed to extract image metadata: ${error.message}`);
  }
};

/**
 * Extract metadata from a buffer (useful for S3 uploads)
 * @param {Buffer} imageBuffer - Image buffer
 * @param {number} fileSize - File size in bytes
 * @returns {Object} Image metadata object
 */
const extractImageMetadataFromBuffer = async (imageBuffer, fileSize) => {
  try {
    // Extract metadata using sharp
    const metadata = await sharp(imageBuffer).metadata();

    // Calculate aspect ratio
    const aspectRatio = metadata.width && metadata.height 
      ? metadata.width / metadata.height 
      : null;

    // Determine if image has alpha channel
    const hasAlpha = metadata.hasAlpha || false;

    // Extract format from metadata
    let format = metadata.format;
    if (format) {
      format = format.toUpperCase();
    }

    return {
      width: metadata.width || null,
      height: metadata.height || null,
      fileSize: fileSize,
      format: format,
      aspectRatio: aspectRatio,
      colorSpace: metadata.space || null,
      hasAlpha: hasAlpha,
      density: metadata.density || null,
      channels: metadata.channels || null,
      depth: metadata.depth || null,
    };
  } catch (error) {
    console.error('Error extracting image metadata from buffer:', error);
    throw new Error(`Failed to extract image metadata: ${error.message}`);
  }
};

module.exports = {
  extractImageMetadata,
  extractImageMetadataFromBuffer,
};
