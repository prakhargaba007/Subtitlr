const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const isAuth = require("../middleware/is-auth");
const categoryController = require("../controllers/categoryController");
const { createUploadMiddleware } = require("../utils/fileUpload");

// Increase payload size limits
router.use(express.json({ limit: "25mb" }));
router.use(express.urlencoded({ limit: "25mb", extended: true }));

// File upload configuration for categories
const categoryUpload = createUploadMiddleware("image", 2);

// Validation middleware
const categoryValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 100 })
    .withMessage("Name cannot exceed 100 characters"),
  body("description").trim(),
];

// Routes
router.post(
  "/",
  isAuth,
  // Use single for just one file with the exact field name from frontend
  ...categoryUpload("categoryImage"),
  categoryValidation,
  categoryController.createCategory
);

// Get all categories (including inactive)
router.get("/", categoryController.getAllCategories);

// Get only active categories
router.get("/active", categoryController.getActiveCategories);

// Get categories by type
router.get("/type/:type", categoryController.getCategoriesByType);

// Get category by ID
router.get("/:id", categoryController.getCategoryById);

// Update category
router.put(
  "/:id",
  isAuth,
  ...categoryUpload("categoryImage"),
  categoryController.updateCategory
);

// Delete category
router.delete("/:id", isAuth, categoryController.deleteCategory);

// Toggle category active status
router.patch(
  "/:id/toggle-status",
  isAuth,
  categoryController.toggleCategoryStatus
);

module.exports = router;
