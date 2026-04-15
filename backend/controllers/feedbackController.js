const Feedback = require("../models/Feedback");
const sendEmail = require("../utils/mailer");

/**
 * POST /api/feedback
 * Anyone can submit — auth is optional (userId attached if logged in).
 */
exports.submitFeedback = async (req, res, next) => {
  try {
    const { name, email, type, rating, message, context } = req.body || {};

    if (!String(name || "").trim()) {
      return res.status(422).json({ message: "Name is required." });
    }
    if (
      !String(email || "").trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(422).json({ message: "A valid email is required." });
    }
    if (!String(message || "").trim() || String(message).trim().length < 5) {
      return res
        .status(422)
        .json({ message: "Message must be at least 5 characters." });
    }

    const validTypes = ["bug", "feature", "general", "praise"];
    const feedbackType = validTypes.includes(type) ? type : "general";
    const feedbackRating = rating >= 1 && rating <= 5 ? Number(rating) : null;

    const doc = await Feedback.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      type: feedbackType,
      rating: feedbackRating,
      message: String(message).trim(),
      context: context ? String(context).trim() : null,
      userId: req.userId || null,
    });

    // ── Notify the owner ──────────────────────────────────────────────────
    const ownerEmail = process.env.OWNER_EMAIL || "prakhargaba@gmail.com";
    const typeLabel = {
      bug: "🐛 Bug Report",
      feature: "💡 Feature Request",
      general: "💬 General",
      praise: "🌟 Praise",
    }[feedbackType];
    const ratingText = feedbackRating
      ? `${"⭐".repeat(feedbackRating)} (${feedbackRating}/5)`
      : "Not rated";

    const ownerHtml = `
      <h2 style="font-family:sans-serif">New Feedback — Dubbing Studio</h2>
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Type</td><td><strong>${typeLabel}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Rating</td><td>${ratingText}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td>${name}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td>${email}</td></tr>
        ${context ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Context</td><td>${context}</td></tr>` : ""}
      </table>
      <p style="font-family:sans-serif;margin-top:16px;background:#f5f5f5;padding:12px;border-radius:6px">${message}</p>
    `;

    // ── Thank-you email to user ────────────────────────────────────────────
    const userHtml = `
      <div style="max-width:520px;margin:auto;padding:24px;font-family:'Segoe UI',Arial,sans-serif;background:#0f1117;border-radius:12px">
        <h2 style="color:#6b63ff;margin-bottom:8px">Thanks for your feedback! 🙌</h2>
        <p style="color:#c5cad3">Hey ${name}, we really appreciate you taking the time to share your thoughts with us.</p>
        <div style="background:#1e2228;border-left:3px solid #6b63ff;padding:12px 16px;border-radius:6px;color:#e8eaed;font-size:14px;margin:20px 0">
          ${message}
        </div>
        <p style="color:#9aa3ad;font-size:13px">We read every piece of feedback and use it to make Dubbing Studio better. 💜</p>
        <p style="color:#9aa3ad;font-size:13px">— The Dubbing Studio Team</p>
      </div>
    `;

    // Fire-and-forget emails (don't block the response)
    res
      .status(201)
      .json({
        success: true,
        id: doc._id,
        message: "Feedback submitted. Thank you!",
      });

    try {
      await sendEmail(
        ownerEmail,
        `[Dubbing Studio Feedback] ${typeLabel} from ${name}`,
        message,
        ownerHtml,
        [],
        3,
        "Dubbing Studio",
      );
      await sendEmail(
        email,
        "Thanks for your feedback — Dubbing Studio",
        message,
        userHtml,
        [],
        3,
        "Dubbing Studio",
      );
    } catch (emailErr) {
      console.warn("[feedback] Email send failed:", emailErr.message);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/feedback  (admin only via isAuth middleware in routes)
 */
exports.getAllFeedback = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const type = req.query.type;
    const filter = type ? { type } : {};

    const [docs, total] = await Promise.all([
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Feedback.countDocuments(filter),
    ]);

    res.json({ feedback: docs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};
