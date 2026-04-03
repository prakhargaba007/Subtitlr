const jwt = require("jsonwebtoken");

// Optional user resolver: sets req.userId if available, never throws
module.exports = (req, res, next) => {
  try {
    // 1) From Bearer token
    const authHeader = req.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1] || "";
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.user && decoded.user.id) {
          req.userId = decoded.user.id;
          return next();
        }
      } catch (_) {
        // ignore token errors for optional middleware
      }
    }

    // 2) From custom header
    const headerUserId = req.get("x-user-id");
    if (headerUserId) {
      req.userId = headerUserId;
      return next();
    }

    // 3) From query param (?user=...)
    if (req.query && req.query.user) {
      req.userId = req.query.user;
      return next();
    }

    // No user available; proceed without setting
    return next();
  } catch (_) {
    // Ensure we never block the request
    return next();
  }
};


