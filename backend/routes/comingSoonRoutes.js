const express = require("express");
const { body } = require("express-validator");
const comingSoonController = require("../controllers/comingSoonController");

const router = express.Router();

// POST /api/coming-soon/notify
router.post(
  "/notify",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("pageKey")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("pageKey is required"),
    body("source").optional().isString().trim(),
  ],
  comingSoonController.notify
);

module.exports = router;

