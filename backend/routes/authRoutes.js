const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const authController = require("../controllers/authController");
const isAuth = require("../middleware/is-auth");
const rateLimit = require("express-rate-limit");

const userRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 attempts
  keyGenerator: (req) => {
    // Rate limit per email or fallback to IP. 
    // express-rate-limit throws a warning if req.ip is used directly for IPv6. We can just stringify it.
    return req.body.email || req.body.id || `ip_${req.ip}`;
  },
  message: { success: false, message: "Too many attempts. Please try again later." }
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { success: false, message: "Too many refresh attempts." }
});


// Route: POST /api/auth/opt-generate
router.post(
  "/opt-generate",
  userRateLimiter,
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
  userRateLimiter,
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
  userRateLimiter,
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
  userRateLimiter,
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
  isAuth,
  authController.resetPassword
);

// Route: POST /api/auth/verify-otp-reset-password
router.post(
  "/verify-otp-reset-password",
  userRateLimiter,
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
  userRateLimiter,
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

// Route: POST /api/auth/refresh
router.post("/refresh", refreshLimiter, authController.refresh);

// Route: POST /api/auth/logout
router.post("/logout", authController.logout);

// Route: POST /api/auth/logout-all
router.post("/logout-all", isAuth, authController.logoutAllDevices);

// Route: GET /api/auth/sessions
router.get("/sessions", isAuth, authController.getSessions);

// Route: POST /api/auth/logout-session/:sessionId
router.post("/logout-session/:sessionId", isAuth, authController.revokeSession);

module.exports = router;
