const { validationResult } = require('express-validator');
const Comment = require('../models/comment');
const Blog = require('../models/blog');
const mongoose = require('mongoose');

// Get comments for a blog
exports.getComments = async (req, res, next) => {
  try {
    const blogId = req.params.blogId;
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.limit) || 10;
    
    // Verify blog exists
    const blog = await Blog.findById(blogId);
    if (!blog) {
      const error = new Error('Blog not found.');
      error.statusCode = 404;
      throw error;
    }

    // Only get top-level comments (no parent)
    const filter = { 
      blog: blogId, 
      parent: null,
      isDeleted: false
    };

    // Count total comments
    const totalItems = await Comment.countDocuments(filter);

    // Get comments with pagination
    const comments = await Comment.find(filter)
      .populate('author', 'name email')
      .populate({
        path: 'replies',
        match: { isDeleted: false },
        options: { sort: { createdAt: 1 } },
        populate: [
          { path: 'author', select: 'name email' }
        ]
      })
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: 'Comments fetched successfully.',
      comments,
      totalItems,
      currentPage,
      perPage,
      totalPages: Math.ceil(totalItems / perPage)
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Get comment replies (for pagination of nested comments)
exports.getCommentReplies = async (req, res, next) => {
  try {
    const commentId = req.params.commentId;
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.limit) || 10;
    
    // Verify parent comment exists
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      const error = new Error('Comment not found.');
      error.statusCode = 404;
      throw error;
    }

    const filter = { 
      parent: commentId,
      isDeleted: false
    };

    // Count total replies
    const totalItems = await Comment.countDocuments(filter);

    // Get replies with pagination
    const replies = await Comment.find(filter)
      .populate('author', 'name email')
      .sort({ createdAt: 1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: 'Comment replies fetched successfully.',
      replies,
      totalItems,
      currentPage,
      perPage,
      totalPages: Math.ceil(totalItems / perPage)
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Create comment
exports.createComment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed.');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const { content, blogId, parentId } = req.body;
    
    // Verify blog exists
    const blog = await Blog.findById(blogId);
    if (!blog) {
      const error = new Error('Blog not found.');
      error.statusCode = 404;
      throw error;
    }

    // Check if comments are allowed for this blog
    if (!blog.allowComments) {
      const error = new Error('Comments are disabled for this blog.');
      error.statusCode = 403;
      throw error;
    }

    // Create comment object
    const comment = new Comment({
      content,
      blog: blogId,
      author: req.userId,
      parent: parentId || null
    });

    const savedComment = await comment.save();
    
    // Populate author details for response
    await savedComment.populate('author', 'name email');

    res.status(201).json({
      message: 'Comment created successfully!',
      comment: savedComment
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Update comment
exports.updateComment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed.');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const commentId = req.params.commentId;
    const { content } = req.body;
    
    const comment = await Comment.findById(commentId);
    
    if (!comment) {
      const error = new Error('Comment not found.');
      error.statusCode = 404;
      throw error;
    }
    
    // Check if user is author or admin
    if (comment.author.toString() !== req.userId && req.role !== 'admin') {
      const error = new Error('Not authorized.');
      error.statusCode = 403;
      throw error;
    }

    // Update comment
    comment.content = content;
    comment.isEdited = true;
    
    const updatedComment = await comment.save();
    
    // Populate author details for response
    await updatedComment.populate('author', 'name email');
    
    res.status(200).json({
      message: 'Comment updated successfully!',
      comment: updatedComment
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Delete comment (soft delete)
exports.deleteComment = async (req, res, next) => {
  try {
    const commentId = req.params.commentId;
    
    const comment = await Comment.findById(commentId);
    
    if (!comment) {
      const error = new Error('Comment not found.');
      error.statusCode = 404;
      throw error;
    }
    
    // Check if user is author or admin
    if (comment.author.toString() !== req.userId && req.role !== 'admin') {
      const error = new Error('Not authorized.');
      error.statusCode = 403;
      throw error;
    }

    // Soft delete - set isDeleted flag
    comment.isDeleted = true;
    comment.content = 'This comment has been deleted';
    
    await comment.save();
    
    res.status(200).json({
      message: 'Comment deleted successfully!'
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

