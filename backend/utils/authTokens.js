const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RefreshToken = require("../models/RefreshToken");

/**
 * IMPORTANT:
 * Cookie `domain` must be consistent across ALL auth endpoints, otherwise browsers can store BOTH
 * a host-only cookie (api.kililabs.io) and a domain cookie (.kililabs.io) with the same name.
 * That leads to two refreshToken entries being sent and non-deterministic server parsing.
 *
 * We decide cookie mode based on the incoming request (host/proto) and allow env overrides.
 */
const isProdRequest = (req) => {
  const host = String(req?.get?.("host") || "");
  const proto = String(req?.get?.("x-forwarded-proto") || "");

  if (process.env.AUTH_COOKIE_MODE === "prod") return true;
  if (process.env.AUTH_COOKIE_MODE === "dev") return false;

  if (host.endsWith(".kililabs.io") || host === "kililabs.io") return true;
  if (proto === "https") return true;

  return process.env.NODE_ENV === "production";
};

const getCookieDomain = (req) => {
  const isProd = isProdRequest(req);
  if (!isProd) return undefined;
  return process.env.COOKIE_DOMAIN || ".kililabs.io";
};

const clearCookieVariants = (res, name, options) => {
  // Clear domain cookie
  res.clearCookie(name, options);
  // Clear host-only cookie variant (no domain attribute)
  const { domain: _domain, ...withoutDomain } = options || {};
  res.clearCookie(name, withoutDomain);
};

const generateTokens = async (user, req, res, familyId = null) => {
  const jti = crypto.randomUUID();

  // 1. Access Token (15 minutes) - includes tokenVersion
  const payload = {
    user: {
      id: user._id,
      role: user.role,
      accessPermissions: user.accessPermissions || [],
    },
    tokenVersion: user.tokenVersion || 0,
    jti,
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

  // 2. Refresh Token (Opaque string, 7 days)
  const rawRefreshToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawRefreshToken)
    .digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const tokenFamily = familyId || crypto.randomUUID();

  // Enforce Max 5 Sessions Per User
  const activeSessions = await RefreshToken.find({
    user: user._id,
    isRevoked: false,
  }).sort({ createdAt: 1 });
  if (activeSessions.length >= 5) {
    // Revoke the oldest session
    await RefreshToken.findByIdAndUpdate(activeSessions[0]._id, {
      isRevoked: true,
    });
  }

  await RefreshToken.create({
    user: user._id,
    tokenHash: tokenHash,
    familyId: tokenFamily,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    expiresAt,
    lastUsedAt: Date.now(),
  });

  // 3. CSRF Token
  const csrfToken = crypto.randomBytes(20).toString("hex");

  // 4. Set Cookies
  const isProd = isProdRequest(req);
  // In production: cross-origin requests (www.kililabs.io → api.kililabs.io)
  // require sameSite:"none" + secure:true for cookies to be sent by browser.
  // In development: sameSite:"lax" works fine since both run on localhost.
  const sameSite = isProd ? "none" : "lax";
  const domain = getCookieDomain(req); // ".kililabs.io" in prod, undefined in dev

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite,
    maxAge: 15 * 60 * 1000, // 15 mins
    path: "/",
    domain,
  });

  res.cookie("refreshToken", rawRefreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    // Your observation is correct: clearing with path "/api/auth" deletes only that cookie.
    // Using Path="/" avoids accidental "disappears on reload" behavior and prevents multiple
    // refreshToken cookies across different paths.
    path: "/",
    domain,
  });

  res.cookie("csrfToken", csrfToken, {
    httpOnly: false, // Must be readable by JS for CSRF header
    secure: isProd,
    sameSite,
    path: "/",
    domain,
  });

  return { accessToken, csrfToken };
};

const clearAuthCookies = (req, res) => {
  const domain = getCookieDomain(req);
  clearCookieVariants(res, "accessToken", { path: "/", domain });
  // Clear both current + historical refresh cookie paths
  clearCookieVariants(res, "refreshToken", { path: "/", domain });
  clearCookieVariants(res, "refreshToken", { path: "/api/auth", domain });
  clearCookieVariants(res, "csrfToken", { path: "/", domain });
};

module.exports = { generateTokens, clearAuthCookies };
