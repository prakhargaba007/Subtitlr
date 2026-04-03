const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { storage } = require("./storage");
const { extractImageMetadataFromBuffer } = require("./imageMetadata");

// File type map
const FILE_TYPE_MAP = {
  image: ["image/png", "image/jpeg", "image/jpg", "image/gif"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  spreadsheet: [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  video: [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "video/x-matroska",
    "video/3gpp",
    "video/3gpp2",
  ],
  all: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument",
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "video/x-matroska",
    "video/3gpp",
    "video/3gpp2",
  ],
};

// Storage configuration for local files
const localStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // console.log("req.body.uploadType", req.body.uploadType);
    // Get uploadType from req.body or use 'files' as fallback
    const uploadType = req.body.uploadType || "files";
    // console.log("uploadType", uploadType);
    const uploadDir = `public/uploads/${uploadType}`;

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename similar to what the controller expects
    const crypto = require("crypto");
    const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  },
});

// Memory storage for S3 mode (files will be uploaded to S3)
const memoryStorage = multer.memoryStorage();

// File filter function generator
const generateFileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    const allowedMimeTypes = FILE_TYPE_MAP[allowedTypes] || allowedTypes;
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Allowed types: " + allowedMimeTypes.join(", ")
        ),
        false
      );
    }
  };
};

// Helper function to upload files to S3 after multer processes them
const uploadFilesToS3 = async (files, uploadType = 'general') => {
  if (!Array.isArray(files)) {
    files = [files];
  }
  
  const uploadedFiles = [];
  
  for (const file of files) {
    if (file) {
      // Generate S3 key
      const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp = Date.now();
      const randomId = Math.round(Math.random() * 1e9);
      const key = `public/uploads/${uploadType}/${timestamp}-${randomId}-${safeName}`;
      
      // Extract image metadata before uploading to S3
      let imageMetadata = null;
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        try {
          imageMetadata = await extractImageMetadataFromBuffer(file.buffer, file.size);
        } catch (error) {
          console.warn("Failed to extract image metadata for S3 upload:", error.message);
        }
      }
      
      // Upload to S3
      await storage.saveFile(file.buffer, key, file.mimetype);
      
      // Extract filename from S3 key
      const filename = path.basename(key);
      
      // Add S3 info to file object
      uploadedFiles.push({
        ...file,
        filename: filename, // Set filename for consistency with local storage
        path: key, // S3 key instead of local path
        s3Key: key,
        s3Url: await storage.getPublicUrl(key),
        imageMetadata: imageMetadata // Include extracted metadata
      });
    }
  }
  
  return uploadedFiles;
};

// Create upload middleware
const createUploadMiddleware = (
  fileTypes = "all",
  maxFiles = 5,
  maxSize = 25
) => {
  // Always use memory storage when S3 is enabled, disk storage for local mode
  const isS3Mode = (process.env.STORAGE_TYPE || 'local') === 's3';
  
  const multerMiddleware = multer({
    storage: isS3Mode ? memoryStorage : localStorage,
    limits: {
      fileSize: maxSize * 1024 * 1024, // Default 25MB, configurable
      files: maxFiles,
    },
    fileFilter: generateFileFilter(
      Array.isArray(fileTypes) ? fileTypes : FILE_TYPE_MAP[fileTypes]
    ),
  });
  
  // If S3 mode, add middleware to upload files to S3 after multer processes them
  if (isS3Mode) {
    return (fieldName) => {
      return [
        multerMiddleware.single(fieldName),
        async (req, res, next) => {
          try {
            if (req.file) {
              const uploadType = req.body.uploadType || 'files';
              const uploadedFiles = await uploadFilesToS3(req.file, uploadType);
              req.file = uploadedFiles[0]; // Replace with S3 file info
            }
            next();
          } catch (error) {
            next(error);
          }
        }
      ];
    };
  }
  
  // For local mode, return the multer middleware directly
  return (fieldName) => multerMiddleware.single(fieldName);
};

// Create video upload middleware with higher size limit
const createVideoUploadMiddleware = (maxFiles = 1, maxSize = 100) => {
  return createUploadMiddleware("video", maxFiles, maxSize);
};

module.exports = {
  createUploadMiddleware,
  createVideoUploadMiddleware,
  uploadFilesToS3,
  FILE_TYPE_MAP,
};
