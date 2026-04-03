const File = require("../models/File");
const crypto = require("crypto");
const path = require("path");

/**
 * Check if a file with similar content already exists
 * @param {Buffer} fileBuffer - The file buffer to check
 * @param {string} mimeType - The MIME type of the file
 * @param {string} uploadType - The type of upload (profiles, courses, etc.)
 * @returns {Object|null} - File object if found, null otherwise
 */
exports.findSimilarFile = async (fileBuffer, mimeType, uploadType) => {
  try {
    // Generate a hash of the file content for comparison
    const fileHash = crypto.createHash("md5").update(fileBuffer).digest("hex");
    
    // For now, we'll use a simple approach based on file size and type
    // In a production system, you might want to implement more sophisticated duplicate detection
    const existingFiles = await File.find({
      mimeType,
      uploadType,
      fileSize: fileBuffer.length,
      isDeleted: false,
      isActive: true,
    }).sort({ createdAt: -1 });

    // Return the most recently uploaded file with similar characteristics
    return existingFiles.length > 0 ? existingFiles[0] : null;
  } catch (error) {
    console.error("Error finding similar file:", error);
    return null;
  }
};

/**
 * Create a file reference
 * @param {string} fileId - The ID of the file to reference
 * @param {string} model - The model name (User, Course, etc.)
 * @param {string} documentId - The document ID
 * @param {string} field - The field name where the file is referenced
 * @returns {Object} - The updated file object
 */
exports.createFileReference = async (fileId, model, documentId, field) => {
  try {
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Check if reference already exists
    const existingReference = file.references.find(
      (ref) => ref.model === model && ref.documentId.toString() === documentId && ref.field === field
    );

    if (existingReference) {
      return file; // Reference already exists
    }

    // Add new reference
    file.references.push({
      model,
      documentId,
      field,
    });

    file.referenceCount = file.references.length;
    await file.save();

    return file;
  } catch (error) {
    console.error("Error creating file reference:", error);
    throw error;
  }
};

/**
 * Remove a file reference
 * @param {string} fileId - The ID of the file
 * @param {string} model - The model name
 * @param {string} documentId - The document ID
 * @param {string} field - The field name
 * @returns {Object} - The updated file object
 */
exports.removeFileReference = async (fileId, model, documentId, field) => {
  try {
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Remove the specific reference
    file.references = file.references.filter(
      (ref) => !(ref.model === model && ref.documentId.toString() === documentId && ref.field === field)
    );

    file.referenceCount = file.references.length;

    // If no references left, mark as deleted
    if (file.referenceCount === 0) {
      file.isDeleted = true;
    }

    await file.save();
    return file;
  } catch (error) {
    console.error("Error removing file reference:", error);
    throw error;
  }
};

/**
 * Get file statistics
 * @returns {Object} - File statistics
 */
exports.getFileStats = async () => {
  try {
    const stats = await File.aggregate([
      {
        $match: { isDeleted: false }
      },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: "$fileSize" },
          totalReferences: { $sum: "$referenceCount" },
          avgReferences: { $avg: "$referenceCount" }
        }
      }
    ]);

    const uploadTypeStats = await File.aggregate([
      {
        $match: { isDeleted: false }
      },
      {
        $group: {
          _id: "$uploadType",
          count: { $sum: 1 },
          totalSize: { $sum: "$fileSize" }
        }
      }
    ]);

    return {
      overall: stats[0] || { totalFiles: 0, totalSize: 0, totalReferences: 0, avgReferences: 0 },
      byType: uploadTypeStats
    };
  } catch (error) {
    console.error("Error getting file stats:", error);
    return { overall: {}, byType: [] };
  }
};

/**
 * Clean up orphaned files (files with no references)
 * @returns {Object} - Cleanup results
 */
exports.cleanupOrphanedFiles = async () => {
  try {
    const orphanedFiles = await File.find({
      referenceCount: 0,
      isDeleted: false
    });

    let cleanedCount = 0;
    for (const file of orphanedFiles) {
      file.isDeleted = true;
      await file.save();
      cleanedCount++;
    }

    return {
      message: `Cleaned up ${cleanedCount} orphaned files`,
      cleanedCount
    };
  } catch (error) {
    console.error("Error cleaning up orphaned files:", error);
    throw error;
  }
};

/**
 * Generate unique filename
 * @param {string} originalName - Original filename
 * @returns {string} - Unique filename
 */
exports.generateUniqueFilename = (originalName) => {
  const extension = path.extname(originalName);
  const uniqueId = crypto.randomBytes(16).toString("hex");
  return `${uniqueId}${extension}`;
};

/**
 * Validate file type and size
 * @param {Object} file - File object from multer
 * @param {Array} allowedTypes - Array of allowed MIME types
 * @param {number} maxSize - Maximum file size in bytes
 * @returns {Object} - Validation result
 */
exports.validateFile = (file, allowedTypes = [], maxSize = 10 * 1024 * 1024) => {
  const errors = [];

  if (!file) {
    errors.push("No file provided");
    return { isValid: false, errors };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
    errors.push(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(", ")}`);
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    errors.push(`File size ${(file.size / (1024 * 1024)).toFixed(2)}MB exceeds maximum allowed size of ${maxSizeMB}MB`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
