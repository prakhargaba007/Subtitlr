const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RefreshToken = require("../models/RefreshToken");

const isProdEnv = () =>
  process.env.NODE_ENV === "production" ||
  (process.env.NODE_ENV !== "development" && (process.env.FRONTEND_URL || "").startsWith("https://"));

const getCookieDomain = () => {
  // For MVP, avoid hardcoding a domain. Setting a mismatched Domain causes cookies
  // to be rejected entirely (common on preview/staging URLs).
  // If you later need cross-subdomain cookies, set COOKIE_DOMAIN explicitly.
  return process.env.COOKIE_DOMAIN || undefined;
};

const shouldUseSecureCookies = (req) => {
  const origin = req.get("Origin") || "";
  if (origin.startsWith("https://")) return true;
  return isProdEnv();
};

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
    // MVP: do not bind sessions to IP/device details
    ipAddress: undefined,
    userAgent: undefined,
    expiresAt,
    lastUsedAt: Date.now(),
  });

  // 3. Set Cookies
  // Cookies must be `sameSite:"none"` + `secure:true` for HTTPS cross-origin XHR.
  // In local dev over http, keep `lax` and `secure:false`.
  const secure = shouldUseSecureCookies(req);
  const sameSite = secure ? "none" : "lax";
  const domain = getCookieDomain();

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 15 * 60 * 1000, // 15 mins
    path: "/",
    domain
  });

  res.cookie("refreshToken", rawRefreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/auth", // Only sent to auth routes
    domain
  });
  return { accessToken };
};

const clearAuthCookies = (res) => {
  const domain = getCookieDomain();
  res.clearCookie("accessToken", { path: "/", domain });
  res.clearCookie("refreshToken", { path: "/api/auth", domain });
};

module.exports = { generateTokens, clearAuthCookies };
