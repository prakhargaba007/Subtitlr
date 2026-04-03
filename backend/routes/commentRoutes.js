const express = require('express');
const { body } = require('express-validator');
const commentController = require('../controllers/commentController');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

// GET /comments/blog/:blogId - Get comments for a blog
router.get('/blog/:blogId', commentController.getComments);

// GET /comments/:commentId/replies - Get replies for a comment
router.get('/:commentId/replies', commentController.getCommentReplies);

// POST /comments - Create new comment (auth required)
router.post(
  '/',
  isAuth,
  [
    body('content')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Comment content cannot be empty.'),
    body('blogId')
      .trim()
      .notEmpty()
      .withMessage('Blog ID is required.')
  ],
  commentController.createComment
);

// PUT /comments/:commentId - Update comment (auth required)
router.put(
  '/:commentId',
  isAuth,
  [
    body('content')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Comment content cannot be empty.')
  ],
  commentController.updateComment
);

// DELETE /comments/:commentId - Delete comment (auth required)
router.delete('/:commentId', isAuth, commentController.deleteComment);

module.exports = router; 