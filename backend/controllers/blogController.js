const { validationResult } = require("express-validator");
const Blog = require("../models/blog");
const Comment = require("../models/comment");
const fs = require("fs");
const path = require("path");

// Helper to create slug from title
const createSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
};

// Get all blogs with pagination, filtering and sorting
exports.getBlogs = async (req, res, next) => {
  try {
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.limit) || 10;
    // let status = "";
    if (req.query.status) {
      // console.log("req.query.status", req.query.status);
      var status = req.query.status;
    }
    const category = req.query.category;
    const tag = req.query.tag;
    const author = req.query.author;
    const search = req.query.search;
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.categories = category;
    if (tag) filter.tags = tag;
    if (author) filter.author = author;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder;

    // Count total blogs matching filter
    const totalItems = await Blog.countDocuments(filter);

    console.log("filter", filter);
    // Get blogs with pagination
    const blogs = await Blog.find(filter)
      .populate("author", "name email")
      .populate("categories", "name slug")
      .sort(sort)
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    console.log("blogs", blogs);

    res.status(200).json({
      message: "Blogs fetched successfully.",
      blogs,
      totalItems,
      currentPage,
      perPage,
      totalPages: Math.ceil(totalItems / perPage),
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Get single blog by slug
exports.getBlog = async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const blog = await Blog.findOne({ slug })
      .populate("author", "name email")
      .populate("categories", "name slug")
      .populate({
        path: "commentCount",
        match: { status: "active" },
      });

    if (!blog) {
      const error = new Error("Blog not found.");
      error.statusCode = 404;
      throw error;
    }

    // Increment view count
    blog.viewCount += 1;
    await blog.save();

    res.status(200).json({
      message: "Blog fetched successfully.",
      blog,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Create new blog
exports.createBlog = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed.");
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const {
      title,
      content,
      categories,
      tags,
      status,
      metaTitle,
      metaDescription,
    } = req.body;
    if (!title || !content) {
      const error = new Error("Title and content are required.");
      error.statusCode = 422;
      throw error;
    }

    // Create slug from title
    let slug = createSlug(title);

    // Check if slug already exists
    const existingBlog = await Blog.findOne({ slug });
    if (existingBlog) {
      // Append timestamp to make slug unique
      slug = `${slug}-${Date.now()}`;
    }

    // Handle featured image
    let featuredImage = "";
    if (req.file) {
      featuredImage = req.file.path.replace("\\", "/");
    }

    // Calculate reading time (rough estimate: 200 words per minute)
    const wordCount = content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    const blog = new Blog({
      title,
      slug,
      content,
      featuredImage,
      author: req.userId,
      categories: categories ? categories.split(",") : [],
      tags: tags ? tags.split(",") : [],
      status: status || "published",
      readingTime,
      metaTitle,
      metaDescription,
    });

    const savedBlog = await blog.save();

    res.status(201).json({
      message: "Blog created successfully!",
      blog: savedBlog,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Update blog
exports.updateBlog = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed.");
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const oldTitle = req.params.title;
    const {
      title,
      content,
      categories,
      tags,
      status,
      metaTitle,
      metaDescription,
    } = req.body;

    const blog = await Blog.findOne({ slug: oldTitle });

    if (!blog) {
      const error = new Error("Blog not found.");
      error.statusCode = 404;
      throw error;
    }

    // Check if user is author or admin
    if (blog.author.toString() !== req.userId && req.role !== "admin") {
      const error = new Error("Not authorized.");
      error.statusCode = 403;
      throw error;
    }

    // Update blog fields
    blog.title = title;
    blog.content = content;

    // Handle categories and tags
    if (categories) {
      blog.categories = categories.split(",");
    }

    if (tags) {
      blog.tags = tags.split(",");
    }

    if (status) {
      blog.status = status;
    }

    // Update slug based on new title
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    blog.slug = slug;

    // Handle featured image if provided
    if (req.file) {
      // Delete old image if exists
      if (blog.featuredImage) {
        const oldImagePath = path.join(__dirname, "..", blog.featuredImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      blog.featuredImage = req.file.path.replace("\\", "/");
    }

    // Update meta fields
    if (metaTitle) blog.metaTitle = metaTitle;
    if (metaDescription) blog.metaDescription = metaDescription;

    // Recalculate reading time
    const wordCount = content.split(/\s+/).length;
    blog.readingTime = Math.ceil(wordCount / 200);

    const updatedBlog = await blog.save();

    res.status(200).json({
      message: "Blog updated successfully!",
      blog: updatedBlog,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Delete blog
exports.deleteBlog = async (req, res, next) => {
  try {
    const blogId = req.params.blogId;

    const blog = await Blog.findById(blogId);

    if (!blog) {
      const error = new Error("Blog not found.");
      error.statusCode = 404;
      throw error;
    }

    // Check if user is author or admin
    if (blog.author.toString() !== req.userId && req.role !== "admin") {
      const error = new Error("Not authorized.");
      error.statusCode = 403;
      throw error;
    }

    // Delete associated image if exists
    if (blog.featuredImage) {
      const imagePath = path.join(__dirname, "..", blog.featuredImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete all comments associated with this blog
    await Comment.deleteMany({ blog: blogId });

    // Delete the blog
    await Blog.findByIdAndDelete(blogId);

    res.status(200).json({
      message: "Blog deleted successfully!",
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Like blog
exports.likeBlog = async (req, res, next) => {
  try {
    const blogId = req.params.blogId;
    const userId = req.userId;

    const blog = await Blog.findById(blogId);

    if (!blog) {
      const error = new Error("Blog not found.");
      error.statusCode = 404;
      throw error;
    }

    await blog.addLike(userId);

    res.status(200).json({
      message: "Blog liked successfully!",
      likeCount: blog.likes.length,
      dislikeCount: blog.dislikes.length,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Dislike blog
exports.dislikeBlog = async (req, res, next) => {
  try {
    const blogId = req.params.blogId;
    const userId = req.userId;

    const blog = await Blog.findById(blogId);

    if (!blog) {
      const error = new Error("Blog not found.");
      error.statusCode = 404;
      throw error;
    }

    await blog.addDislike(userId);

    res.status(200).json({
      message: "Blog disliked successfully!",
      likeCount: blog.likes.length,
      dislikeCount: blog.dislikes.length,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Remove like/dislike
exports.removeReaction = async (req, res, next) => {
  try {
    const blogId = req.params.blogId;
    const userId = req.userId;
    const type = req.query.type || "like";

    const blog = await Blog.findById(blogId);

    if (!blog) {
      const error = new Error("Blog not found.");
      error.statusCode = 404;
      throw error;
    }

    if (type === "like") {
      await blog.removeLike(userId);
    } else {
      await blog.removeDislike(userId);
    }

    res.status(200).json({
      message: `${type === "like" ? "Like" : "Dislike"} removed successfully!`,
      likeCount: blog.likes.length,
      dislikeCount: blog.dislikes.length,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Get featured blogs
exports.getFeaturedBlogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const blogs = await Blog.find({ status: "published", isFeatured: true })
      .populate("author", "name email")
      .populate("categories", "name slug")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({
      message: "Featured blogs fetched successfully.",
      blogs,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Get related blogs
exports.getRelatedBlogs = async (req, res, next) => {
  try {
    const blogId = req.params.blogId;
    const limit = parseInt(req.query.limit) || 3;

    const blog = await Blog.findById(blogId);

    if (!blog) {
      const error = new Error("Blog not found.");
      error.statusCode = 404;
      throw error;
    }

    // Find blogs with same categories or tags
    const relatedBlogs = await Blog.find({
      _id: { $ne: blogId },
      status: "published",
      $or: [
        { categories: { $in: blog.categories } },
        { tags: { $in: blog.tags } },
      ],
    })
      .populate("author", "name email")
      .populate("categories", "name slug")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({
      message: "Related blogs fetched successfully.",
      blogs: relatedBlogs,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
