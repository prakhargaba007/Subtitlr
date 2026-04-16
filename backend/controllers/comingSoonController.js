const { validationResult } = require("express-validator");
const ComingSoonSignup = require("../models/ComingSoonSignup");
const { sendComingSoonAckEmail } = require("../utils/comingSoonEmail");

exports.notify = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const first = errors.array()[0];
      return res.status(400).json({
        success: false,
        message: first?.msg || "Validation failed",
        errors: errors.array(),
      });
    }

    const { email, pageKey, source } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPageKey = String(pageKey || "").trim().toLowerCase();
    const normalizedSource = String(source || "").trim() || null;

    const meta = {
      ip:
        (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
        req.ip ||
        null,
      userAgent: req.get("user-agent") || null,
      referrer: req.get("referer") || null,
    };

    let alreadyRegistered = false;

    try {
      await ComingSoonSignup.create({
        email: normalizedEmail,
        pageKey: normalizedPageKey,
        source: normalizedSource,
        meta,
      });
    } catch (e) {
      // Duplicate key error from unique index (email, pageKey)
      if (e && (e.code === 11000 || String(e.message || "").includes("E11000"))) {
        alreadyRegistered = true;
      } else {
        throw e;
      }
    }

    res.status(200).json({ success: true, alreadyRegistered });

    // Fire-and-forget acknowledgement email (don't block the response)
    try {
      await sendComingSoonAckEmail(normalizedEmail, normalizedPageKey);
    } catch (emailErr) {
      console.warn("[coming-soon] Email send failed:", emailErr.message);
    }
  } catch (err) {
    next(err);
  }
};

