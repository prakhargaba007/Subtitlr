const sendEmail = require("./mailer");

function safeOrigin() {
  const raw = String(process.env.FRONTEND_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function buildExportLink(jobId) {
  const origin = safeOrigin();
  if (!origin) return null;
  return `${origin}/dubbing/export?jobId=${encodeURIComponent(String(jobId))}`;
}

async function sendDubbingCompletedEmail({ email, jobId, fileName, targetLanguage }) {
  const subject = "Your dubbing is ready (Kili)";
  const link = buildExportLink(jobId);

  const text = [
    "Your dubbing is complete.",
    fileName ? `File: ${fileName}` : null,
    targetLanguage ? `Target language: ${targetLanguage}` : null,
    link ? `Open export: ${link}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="max-width:560px;margin:auto;padding:24px;font-family:'Segoe UI',Arial,sans-serif;background:#0f1117;border-radius:12px">
      <h2 style="color:#6b63ff;margin:0 0 8px 0">Your dubbing is ready</h2>
      <p style="color:#c5cad3;margin:0 0 16px 0">
        Your dubbing job has finished processing.
      </p>
      <div style="background:#1e2228;padding:14px 16px;border-radius:10px;color:#e8eaed;font-size:14px;margin:16px 0">
        ${fileName ? `<div style="margin:0 0 6px 0"><strong>File:</strong> ${String(fileName)}</div>` : ""}
        ${targetLanguage ? `<div style="margin:0"><strong>Target:</strong> ${String(targetLanguage)}</div>` : ""}
      </div>
      ${
        link
          ? `<a href="${link}" style="display:inline-block;background:#6b63ff;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:999px;font-weight:700">Open export</a>`
          : `<p style="color:#9aa3ad;font-size:13px;margin:0">Open the app to download your results.</p>`
      }
      <p style="color:#9aa3ad;font-size:13px;margin:18px 0 0 0">— The Kili Team</p>
    </div>
  `;

  return await sendEmail(email, subject, text, html, [], 3, "Kili");
}

module.exports = { sendDubbingCompletedEmail };

