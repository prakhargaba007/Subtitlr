const express = require('express');
const { body } = require('express-validator');
const tagController = require('../controllers/tagController');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

// GET /api/tags - Get all tags
router.get('/', tagController.getTags);

// GET /api/tags/:id - Get a single tag by ID
router.get('/:id', tagController.getTag);

// POST /api/tags - Create a new tag
router.post(
  '/',
  isAuth,
  [
    body('name')
      .trim()
      .isLength({ min: 2 })
      .withMessage('Tag name must be at least 2 characters long')
  ],
  tagController.createTag
);

// PUT /api/tags/:id - Update a tag
router.put(
  '/:id',
  isAuth,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage('Tag name must be at least 2 characters long')
  ],
  tagController.updateTag
);

// DELETE /api/tags/:id - Delete a tag (soft delete)
router.delete('/:id', isAuth, tagController.deleteTag);

module.exports = router; 