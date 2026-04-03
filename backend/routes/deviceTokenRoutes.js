const express = require("express");
const { body } = require("express-validator");
const deviceTokenController = require("../controllers/deviceTokenController");
const isAuth = require("../middleware/is-auth");
const isAdmin = require("../middleware/is-admin");
const optionalUser = require("../middleware/optional-user");
const { createUploadMiddleware } = require("../utils/fileUpload");

const router = express.Router();

// Validation middleware
const tokenValidation = [
  body("expoPushToken")
    .notEmpty()
    .withMessage("Expo push token is required")
    .isString()
    .withMessage("Expo push token must be a string"),
];

const notificationValidation = [
  body("title")
    .notEmpty()
    .withMessage("Notification title is required")
    .isString()
    .withMessage("Title must be a string"),
  body("body")
    .notEmpty()
    .withMessage("Notification body is required")
    .isString()
    .withMessage("Body must be a string"),
];

// Device token registration - can be done without authentication
router.post(
  "/register",
  optionalUser,
  tokenValidation,
  deviceTokenController.registerDeviceToken
);

// Update token on login - requires authentication
router.put("/login", isAuth, tokenValidation, deviceTokenController.loginUser);

// Update token on logout - requires authentication
router.put(
  "/logout",
  isAuth,
  tokenValidation,
  deviceTokenController.logoutUser
);

// Deregister token - can be done without authentication
router.delete(
  "/deregister",
  tokenValidation,
  deviceTokenController.deregisterDeviceToken
);

// Admin routes - require admin role
// Get all device tokens
router.get("/", isAuth, isAdmin, deviceTokenController.getAllDeviceTokens);

// Get tokens for a specific user
router.get(
  "/user/:userId",
  isAuth,
  isAdmin,
  deviceTokenController.getUserDeviceTokens
);

// Send notification to specific devices
router.post(
  "/send-notification",
  // isAuth,
  // isAdmin,
  createUploadMiddleware("image", 1, 5)("notificationImage"),
  [
    ...notificationValidation,
    body("tokens")
      .isArray()
      .withMessage("Tokens must be an array")
      .notEmpty()
      .withMessage("At least one token is required"),
  ],
  deviceTokenController.sendNotification
);

// Broadcast notification to all users or filtered by role
router.post(
  "/broadcast",
  isAuth,
  isAdmin,
  createUploadMiddleware("image", 1, 5)("notificationImage"),
  [
    ...notificationValidation,
    body("role")
      .optional()
      .isIn(["admin", "instructor", "student", "influencer"])
      .withMessage("Role must be one of: admin, instructor, student, influencer"),
    body("onlyLoggedIn")
      .optional()
      .isBoolean()
      .withMessage("onlyLoggedIn must be a boolean"),
  ],
  deviceTokenController.broadcastNotification
);

// Get notification history
router.get(
  "/notification-history",
  isAuth,
  isAdmin,
  deviceTokenController.getNotificationHistory
);


module.exports = router;
