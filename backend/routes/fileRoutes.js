const express = require("express");
const router = express.Router();
const fileController = require("../controllers/fileController");
const isAuth = require("../middleware/is-auth");
const isAdmin = require("../middleware/is-admin");
const { createUploadMiddleware } = require("../utils/fileUpload");

// Increase payload size limits
router.use(express.json({ limit: "25mb" }));
router.use(express.urlencoded({ limit: "25mb", extended: true }));

// Apply file upload middleware to routes that need it
const upload = createUploadMiddleware("all", 1, 25);

// Route to upload a new file
router.post(
  "/upload",
  isAuth,
  isAdmin,
  ...upload("file"),
  fileController.uploadFile
);

// Route to reference an existing file
// router.post("/reference", isAuth, isAdmin, fileController.referenceFile);

// Route to remove a file reference
// router.delete(
//   "/reference",
//   isAuth,
//   isAdmin,
//   fileController.removeFileReference
// );

// Route to get file statistics
router.get("/stats", isAuth, isAdmin, fileController.getFileStats);

// Route to get all files (with pagination and filtering)
router.get("/all", isAuth, isAdmin, fileController.getAllFiles);

// Route to search files
router.get("/search", isAuth, isAdmin, fileController.searchFiles);

// Route to get file by ID
router.get("/:id", isAuth, isAdmin, fileController.getFileById);

// Route to delete file (admin only)
router.delete("/:id", isAuth, isAdmin, fileController.deleteFile);

module.exports = router;
