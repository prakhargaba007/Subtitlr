const express = require("express");
const { body } = require("express-validator");
const blogController = require("../controllers/blogController");
const isAuth = require("../middleware/is-auth");
const isAdmin = require("../middleware/is-admin");
const { createUploadMiddleware } = require("../utils/fileUpload");

const router = express.Router();
const blogImageUpload = createUploadMiddleware("image", 1, 10);

// GET /blogs - Get all blogs with pagination, filtering and sorting
router.get("/", blogController.getBlogs);

// GET /blogs/featured - Get featured blogs
router.get("/featured", blogController.getFeaturedBlogs);

// GET /blogs/:slug - Get single blog by slug
router.get("/:slug", blogController.getBlog);

// GET /blogs/:blogId/related - Get related blogs
router.get("/:blogId/related", blogController.getRelatedBlogs);

// POST /blogs - Create new blog (auth required)
router.post(
  "/",
  isAuth,
  ...blogImageUpload("image"),
  // [
  //   body("title")
  //     .trim()
  //     .isLength({ min: 5 })
  //     .withMessage("Title must be at least 5 characters long."),
  //   body("content")
  //     .trim()
  //     .isLength({ min: 10 })
  //     .withMessage("Content must be at least 10 characters long."),
  // ],
  blogController.createBlog,
);

// PUT /blogs/:blogId - Update blog (auth required)
router.put(
  "/:title",
  isAuth,
  ...blogImageUpload("image"),
  [
    body("title")
      .trim()
      .isLength({ min: 5 })
      .withMessage("Title must be at least 5 characters long."),
    body("content")
      .trim()
      .isLength({ min: 10 })
      .withMessage("Content must be at least 10 characters long."),
  ],
  blogController.updateBlog,
);

// DELETE /blogs/:blogId - Delete blog (auth required)
router.delete("/:blogId", isAuth, blogController.deleteBlog);

// POST /blogs/:blogId/like - Like blog (auth required)
router.post("/:blogId/like", isAuth, blogController.likeBlog);

// POST /blogs/:blogId/dislike - Dislike blog (auth required)
router.post("/:blogId/dislike", isAuth, blogController.dislikeBlog);

// DELETE /blogs/:blogId/reaction - Remove reaction (auth required)
router.delete("/:blogId/reaction", isAuth, blogController.removeReaction);

module.exports = router;
