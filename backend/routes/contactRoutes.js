const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const contactController = require('../controllers/contactController');
const isAuth = require('../middleware/is-auth');

// POST /api/contact - Submit a new contact message
router.post('/', [
  // Validate name
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  
  // Validate email
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address'),
  
  // Validate phone
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[0-9+\s()-]{8,}$/)
    .withMessage('Please enter a valid phone number'),
  
  // Validate message
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10 })
    .withMessage('Message must be at least 10 characters long'),
], contactController.submitContact);

// GET /api/contact - Get all contact messages (admin only)
router.get('/', isAuth, contactController.getAllContacts);

module.exports = router; 