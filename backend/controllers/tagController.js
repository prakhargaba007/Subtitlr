const { validationResult } = require('express-validator');
const Tag = require('../models/Tag');

// Get all tags
exports.getTags = async (req, res, next) => {
  try {
    const { 
      search, 
      page = 1, 
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc',
      status = 'all'
    } = req.query;

    // Build query object
    const query = { isDeleted: false };

    // Add status filter
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const [tags, totalCount] = await Promise.all([
      Tag.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Tag.countDocuments(query)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
      tags,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get a single tag by ID
exports.getTag = async (req, res, next) => {
  try {
    const tag = await Tag.findById(req.params.id);
    
    if (!tag || tag.isDeleted) {
      const error = new Error('Tag not found');
      error.statusCode = 404;
      throw error;
    }
    
    res.status(200).json(tag);
  } catch (err) {
    next(err);
  }
};

// Create a new tag
exports.createTag = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description } = req.body;

  try {
    // Check if tag with same name already exists
    const existingTag = await Tag.findOne({ name: name });
    if (existingTag) {
      const error = new Error('Tag with this name already exists');
      error.statusCode = 400;
      throw error;
    }

    const tag = new Tag({
      name,
      description
    });

    const result = await tag.save();
    res.status(201).json({
      message: 'Tag created successfully',
      tag: result
    });
  } catch (err) {
    next(err);
  }
};

// Update a tag
exports.updateTag = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, isActive } = req.body;
  const tagId = req.params.id;

  try {
    const tag = await Tag.findById(tagId);
    
    if (!tag || tag.isDeleted) {
      const error = new Error('Tag not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if another tag with the updated name already exists
    if (name && name !== tag.name) {
      const existingTag = await Tag.findOne({ name: name });
      if (existingTag) {
        const error = new Error('Tag with this name already exists');
        error.statusCode = 400;
        throw error;
      }
    }

    // Update fields
    if (name) tag.name = name;
    if (description !== undefined) tag.description = description;
    if (isActive !== undefined) tag.isActive = isActive;

    const result = await tag.save();
    res.status(200).json({
      message: 'Tag updated successfully',
      tag: result
    });
  } catch (err) {
    next(err);
  }
};

// Delete a tag (soft delete)
exports.deleteTag = async (req, res, next) => {
  const tagId = req.params.id;

  try {
    const tag = await Tag.findById(tagId);
    
    if (!tag || tag.isDeleted) {
      const error = new Error('Tag not found');
      error.statusCode = 404;
      throw error;
    }

    tag.isDeleted = true;
    await tag.save();

    res.status(200).json({
      message: 'Tag deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}; 