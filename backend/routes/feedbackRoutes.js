const express = require("express");
const router = express.Router();
const isAuth = require("../middleware/is-auth");
const { submitFeedback, getAllFeedback } = require("../controllers/feedbackController");

// POST /api/feedback — no auth required (anyone can send feedback)
// userId is populated from JWT if present, ignored if not
router.post("/", (req, res, next) => {
  // Try to decode JWT silently — userId is optional on feedback
  const jwt = require("jsonwebtoken");
  const authHeader = req.get("Authorization");
  if (authHeader) {
    try {
      const token = authHeader.split(" ")[1] || "";
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.user?.id) req.userId = decoded.user.id;
    } catch {
      // invalid or expired token — proceed without userId
    }
  }
  next();
}, submitFeedback);

// GET /api/feedback — admin only
router.get("/", isAuth, getAllFeedback);

module.exports = router;
