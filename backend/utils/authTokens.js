const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RefreshToken = require("../models/RefreshToken");

const getCookieDomain = () => process.env.NODE_ENV === "production" ? ".kililabs.io" : undefined;

const generateTokens = async (user, req, res, familyId = null) => {
  const jti = crypto.randomUUID();

  // 1. Access Token (15 minutes) - includes tokenVersion
  const payload = { 
    user: { 
      id: user._id, 
      role: user.role, 
      accessPermissions: user.accessPermissions || [] 
    },
    tokenVersion: user.tokenVersion || 0,
    jti
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" });

  // 2. Refresh Token (Opaque string, 7 days)
  const rawRefreshToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  const tokenFamily = familyId || crypto.randomUUID();

  // Enforce Max 5 Sessions Per User
  const activeSessions = await RefreshToken.find({ user: user._id, isRevoked: false }).sort({ createdAt: 1 });
  if (activeSessions.length >= 5) {
     // Revoke the oldest session
     await RefreshToken.findByIdAndUpdate(activeSessions[0]._id, { isRevoked: true });
  }

  await RefreshToken.create({
    user: user._id,
    tokenHash: tokenHash,
    familyId: tokenFamily,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    expiresAt,
    lastUsedAt: Date.now(),
  });

  // 3. CSRF Token
  const csrfToken = crypto.randomBytes(20).toString("hex");

  // 4. Set Cookies
  const isProd = process.env.NODE_ENV === "production";
  const domain = getCookieDomain();
  
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 15 * 60 * 1000, // 15 mins
    path: "/",
    domain
  });

  res.cookie("refreshToken", rawRefreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/auth", // Only sent to auth routes
    domain
  });

  res.cookie("csrfToken", csrfToken, {
    httpOnly: false, // Must be readable by JS Axios
    secure: isProd,
    sameSite: "lax",
    path: "/",
    domain
  });

  return { accessToken, csrfToken };
};

const clearAuthCookies = (res) => {
  const domain = getCookieDomain();
  res.clearCookie("accessToken", { path: "/", domain });
  res.clearCookie("refreshToken", { path: "/api/auth", domain });
  res.clearCookie("csrfToken", { path: "/", domain });
};

module.exports = { generateTokens, clearAuthCookies };
