const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    // 1. Get token from HttpOnly cookie (fallback to Auth header for non-browser clients)
    const token = req.cookies?.accessToken || (req.get("Authorization")?.split(" ")[1]);
    
    if (!token) {
      console.log(`[AUTH] 401 - Missing accessToken cookie. URL: ${req.originalUrl}, Cookies:`, Object.keys(req.cookies || {}));
      return res.status(401).json({ message: "Not authenticated!" });
    }

    // 2. CSRF Protection for mutating requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const csrfCookie = req.cookies?.csrfToken;
      const csrfHeader = req.get("X-CSRF-Token");
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return res.status(403).json({ message: "CSRF validation failed" });
      }
    }

    // 3. Verify JWT
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decodedToken) {
      return res.status(401).json({ message: "Not authenticated!" });
    }

    // 4. Validate Token Version to support instant global revocation
    const user = await User.findById(decodedToken.user.id).select('tokenVersion');
    if (!user) {
      console.log(`[AUTH] 401 - User ${decodedToken.user.id} not found in DB`);
      return res.status(401).json({ message: "User no longer exists." });
    }

    const dbTokenVersion = user.tokenVersion || 0;
    if (dbTokenVersion !== decodedToken.tokenVersion) {
      console.log(`[AUTH] 401 - Version mismatch for ${decodedToken.user.id}. Token: ${decodedToken.tokenVersion}, DB: ${dbTokenVersion}`);
      return res.status(401).json({ message: "Session invalidated. Please log in again." });
    }

    req.userId = decodedToken.user.id;
    next();
  } catch (err) {
    console.error(`[AUTH] 401 - JWT Verification Failed: ${err.message}`);
    if (!err.statusCode) {
      err.statusCode = 401;
    }
    next(err);
  }
};
