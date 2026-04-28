// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const isAuth = require("../middleware/is-auth");
const isAdmin = require("../middleware/is-admin");
const userController = require("../controllers/userController");
const { createUploadMiddleware } = require("../utils/fileUpload");

// Configure file upload middleware
const profileUpload = createUploadMiddleware("image", 1, 5); // image type, max 1 file, 5MB limit

// Profile routes
router.get("/profile", isAuth, userController.getUserProfile);
router.put(
  "/update-profile",
  isAuth,
  ...profileUpload("profilePicture"),
  userController.updateUserProfile
);

// Admin profile management routes
router.post(
  "/create",
  isAuth,
  ...profileUpload("profilePicture"),
  userController.createUser
);
router.put(
  "/update-profile/:id",
  isAuth,
  ...profileUpload("profilePicture"),
  userController.updateUserProfile
);
router.delete("/delete/:id", isAuth, userController.deleteAccount);
router.put("/verify/:id", isAuth, userController.verifyUser);

// Language and skill level routes
router.put("/update-language", isAuth, userController.updateLanguage);
router.put("/update-skill-level", isAuth, userController.updateSkillLevel);

// Badge management routes
router.post("/award-badge", isAuth, userController.awardBadge);
router.delete("/remove-badge", isAuth, userController.removeBadge);

// Streak management routes
router.put("/update-streak", isAuth, userController.updateStreak);
router.post("/increment-streak", isAuth, userController.incrementStreak);

// Account status routes
router.put("/verify", isAuth, userController.verifyUser);
router.put("/deactivate", isAuth, userController.deactivateAccount);
router.put("/reactivate", isAuth, userController.reactivateAccount);
router.delete("/delete", isAuth, userController.deleteAccount);

// User listing routes
router.get("/all", isAuth, isAdmin, userController.getAllUsers);
router.get("/role/:role", isAuth, userController.getUsersByRole);
router.get("/:id", userController.getUserById);

module.exports = router;
