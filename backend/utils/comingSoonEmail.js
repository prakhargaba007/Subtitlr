const sendEmail = require("./mailer");

function prettyPageLabel(pageKey) {
  const raw = String(pageKey || "").trim();
  if (!raw) return "this page";
  return raw
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(" ");
}

async function sendComingSoonAckEmail(email, pageKey) {
  const label = prettyPageLabel(pageKey);
  const subject = `You're on the list — ${label} (Kili)`;
  const text = `You're registered. We'll notify you when ${label} is live.`;

  const html = `
    <div style="max-width:520px;margin:auto;padding:24px;font-family:'Segoe UI',Arial,sans-serif;background:#0f1117;border-radius:12px">
      <h2 style="color:#6b63ff;margin-bottom:8px">You're on the list</h2>
      <p style="color:#c5cad3;margin:0 0 16px 0">
        We'll notify you when <strong style="color:#ffffff">${label}</strong> is live.
      </p>
      <div style="background:#1e2228;border-left:3px solid #6b63ff;padding:12px 16px;border-radius:6px;color:#e8eaed;font-size:14px;margin:20px 0">
        If you didn't request this, you can ignore this email.
      </div>
      <p style="color:#9aa3ad;font-size:13px;margin:0">— The Kili Team</p>
    </div>
  `;

  return await sendEmail(email, subject, text, html, [], 3, "Kili");
}

module.exports = { sendComingSoonAckEmail };

