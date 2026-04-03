const File = require("../models/File");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Function to upload a new file
exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error("No file uploaded");
      error.statusCode = 400;
      throw error;
    }

    const { title } = req.body;
    if (!title || !title.trim()) {
      const error = new Error("Title is required");
      error.statusCode = 400;
      throw error;
    }

    // const { uploadType = "general" } = req.body;
    const userId = req.userId;

    // Debug: Log the entire req.file object
    // console.log("req.file object:", JSON.stringify(req.file, null, 2));
    
    // Use the filename that was already set by multer, or generate one if missing
    let uniqueFileName = req.file.filename;
    
    // Fallback: Generate filename if not provided (shouldn't happen but just in case)
    if (!uniqueFileName) {
      // console.log("Warning: filename not provided, generating one");
      const fileExtension = path.extname(req.file.originalname);
      uniqueFileName = `${crypto.randomBytes(16).toString("hex")}${fileExtension}`;
    }
    
    // The file is already in the correct location with the correct name
    // No need to move or rename it
    const permanentPath = `public/uploads/files/${uniqueFileName}`;
    const fullPath = req.file.path; // File is already in the correct location
    
    // console.log("File uploaded successfully to:", fullPath);
    // console.log("File name:", uniqueFileName);
    // console.log("Permanent path:", permanentPath);

    // Create file record
    const file = new File({
      title: title.trim(),
      originalName: req.file.originalname,
      fileName: uniqueFileName,
      filePath: permanentPath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      // uploadType,
      uploadedBy: userId,
      // references: [
      //   {
      //     model: req.body.model || "User",
      //     documentId: req.body.documentId || userId,
      //     field: req.body.field || "profilePicture",
      //   },
      // ],
    });

    await file.save();

    res.status(201).json({
      message: "File uploaded successfully",
      file: {
        _id: file._id,
        title: file.title,
        originalName: file.originalName,
        fileName: file.fileName,
        filePath: file.filePath,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        // uploadType: file.uploadType,
        // referenceCount: file.referenceCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Function to reference an existing file
// exports.referenceFile = async (req, res, next) => {
//   try {
//     const { fileId, model, documentId, field } = req.body;

//     if (!fileId || !model || !documentId || !field) {
//       const error = new Error("Missing required fields: fileId, model, documentId, field");
//       error.statusCode = 400;
//       throw error;
//     }

//     const file = await File.findById(fileId);
//     if (!file) {
//       const error = new Error("File not found");
//       error.statusCode = 404;
//       throw error;
//     }

//     if (!file.isActive || file.isDeleted) {
//       const error = new Error("File is not available");
//       error.statusCode = 400;
//       throw error;
//     }

//     // Check if reference already exists
//     const existingReference = file.references.find(
//       (ref) => ref.model === model && ref.documentId.toString() === documentId && ref.field === field
//     );

//     if (existingReference) {
//       return res.status(200).json({
//         message: "File already referenced",
//         file: {
//           _id: file._id,
//           originalName: file.originalName,
//           fileName: file.fileName,
//           filePath: file.filePath,
//           fileSize: file.fileSize,
//           mimeType: file.mimeType,
//           uploadType: file.uploadType,
//           referenceCount: file.referenceCount,
//         },
//       });
//     }

//     // Add new reference
//     file.references.push({
//       model,
//       documentId,
//       field,
//     });

//     file.referenceCount = file.references.length;
//     await file.save();

//     res.status(200).json({
//       message: "File referenced successfully",
//       file: {
//         _id: file._id,
//         originalName: file.originalName,
//         fileName: file.fileName,
//         filePath: file.filePath,
//         fileSize: file.fileSize,
//         mimeType: file.mimeType,
//         uploadType: file.uploadType,
//         referenceCount: file.referenceCount,
//       },
//     });
//   } catch (err) {
//     next(err);
//     }
// };

// Function to remove a file reference
// exports.removeFileReference = async (req, res, next) => {
//   try {
//     const { fileId, model, documentId, field } = req.body;

//     if (!fileId || !model || !documentId || !field) {
//       const error = new Error("Missing required fields: fileId, model, documentId, field");
//       error.statusCode = 400;
//       throw error;
//     }

//     const file = await File.findById(fileId);
//     const file = await File.findById(fileId);
//     if (!file) {
//       const error = new Error("File not found");
//       error.statusCode = 404;
//       throw error;
//     }

//     // Remove the specific reference
//     file.references = file.references.filter(
//       (ref) => !(ref.model === model && ref.documentId.toString() === documentId && ref.field === field)
//     );

//     file.referenceCount = file.references.length;

//     // If no references left, mark as deleted (soft delete)
//     if (file.referenceCount === 0) {
//       file.isDeleted = true;
//     }

//     await file.save();

//     res.status(200).json({
//       message: "File reference removed successfully",
//       file: {
//         _id: file._id,
//         originalName: file.originalName,
//         fileName: file.fileName,
//         filePath: file.filePath,
//         fileSize: file.fileSize,
//         mimeType: file.mimeType,
//         uploadType: file.uploadType,
//         referenceCount: file.referenceCount,
//         isDeleted: file.isDeleted,
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// Function to get all files (with pagination and filtering)
exports.getAllFiles = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, uploadedBy, search } = req.query;
    const skip = (page - 1) * limit;

    let query = { isDeleted: false };

    // if (uploadType) query.uploadType = uploadType;
    if (uploadedBy) query.uploadedBy = uploadedBy;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { originalName: { $regex: search, $options: "i" } },
        { fileName: { $regex: search, $options: "i" } },
      ];
    }

    const files = await File.find(query)
      .populate("uploadedBy", "name userName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await File.countDocuments(query);

    res.status(200).json({
      files,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalCount: total,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < Math.ceil(total / limit),
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Function to get file by ID
exports.getFileById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const file = await File.findById(id)
      .populate("uploadedBy", "name userName email");
      // .populate("references.documentId");

    if (!file) {
      const error = new Error("File not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({ file });
  } catch (err) {
    next(err);
  }
};

// Function to delete file (admin only)
exports.deleteFile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const file = await File.findById(id);
    if (!file) {
      const error = new Error("File not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if file is referenced elsewhere
    // if (file.referenceCount > 0) {
    //   return res.status(400).json({
    //     message: "Cannot delete file that is still referenced. Remove all references first.",
    //     referenceCount: file.referenceCount,
    //   });
    // }

    // Delete physical file
    const fullPath = path.join(process.cwd(), "public", file.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Delete from database
    await File.findByIdAndDelete(id);

    res.status(200).json({ message: "File deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// Function to search files by content type or name
exports.searchFiles = async (req, res, next) => {
  try {
    const { query, mimeType } = req.query;
    const limit = parseInt(req.query.limit) || 20;

    let searchQuery = { isDeleted: false, isActive: true };

    // if (uploadType) searchQuery.uploadType = uploadType;
    if (mimeType) searchQuery.mimeType = { $regex: mimeType, $options: "i" };

    if (query) {
      searchQuery.$or = [
        { title: { $regex: query, $options: "i" } },
        { originalName: { $regex: query, $options: "i" } },
        { fileName: { $regex: query, $options: "i" } },
      ];
    }

    const files = await File.find(searchQuery)
      .select("originalName fileName filePath mimeType")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({ files });
  } catch (err) {
    next(err);
  }
};

// Function to get file statistics
exports.getFileStats = async (req, res, next) => {
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
          // totalReferences: { $sum: "$referenceCount" },
          // avgReferences: { $avg: "$referenceCount" }
        }
      }
    ]);

    // const uploadTypeStats = await File.aggregate([
    //   {
    //     $match: { isDeleted: false }
    //   },
    //   {
    //     $group: {
    //       _id: "$uploadType",
    //       count: { $sum: 1 },
    //       totalSize: { $sum: "$fileSize" }
    //     }
    //   }
    // ]);

    res.status(200).json({
      overall: stats[0] || { totalFiles: 0, totalSize: 0 },
      // byType: uploadTypeStats
    });
  } catch (err) {
    next(err);
  }
};
