const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const authController = require("../controllers/authController");
const isAuth = require("../middleware/is-auth");


// Route: POST /api/auth/opt-generate
router.post(
  "/opt-generate",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
  ],
  authController.optGenerte
);

// Route: POST /api/auth/signup
router.post(
  "/signup",
  [
    // Validate inputs
    body("name")
      .not()
      .isEmpty()
      .trim()
      .escape()
      .withMessage("Name is required"),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("userName")
      .not()
      .isEmpty()
      .trim()
      .escape()
      .withMessage("Username is required")
      .custom((value) => {
        if (value.includes("@")) {
          throw new Error("Username should not contain '@'");
        }
        return true;
      }),
  ],
  authController.signup
);

// Route: POST /api/auth/login
router.post(
  "/login",
  [
    // Validate inputs
    body("id").notEmpty().withMessage("Valid userName or email is required"),
    body("password").custom((value, { req }) => {
      // Allow missing password when provider is google
      if (req.body && req.body.provider === "google") {
        return true;
      }
      if (!value) {
        throw new Error("Password is required");
      }
      return true;
    }),
  ],
  authController.login
);

// Route: POST /api/auth/google-exchange (OAuth code → tokens → user)
router.post("/google-exchange", authController.googleExchange);

// Route: POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
  ],
  authController.forgotPassword
);

// Route: POST /api/auth/reset-password
router.put(
  "/reset-password",
  [
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  // isAuth,
  authController.resetPassword
);

// Route: POST /api/auth/verify-otp-reset-password
router.post(
  "/verify-otp-reset-password",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("otp")
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be 6 digits"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  authController.verifyOTPAndResetPassword
);

// Route: POST /api/auth/verify-otp
router.post(
  "/verify-otp",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("otp")
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be 6 digits"),
  ],
  authController.verifyOTPForSignIn
);

router.get("/verify", isAuth, authController.verify);

module.exports = router;
