"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const { headS3ObjectMeta, downloadS3ObjectToFile } = require("../utils/storage");
const AUDIO_VIDEO_MIMES = require("../constants/audioVideoMimes");

/**
 * When `req.body.s3Key` is set, HEAD + download to temp, then wire `req.subtitleTmpProbeFile` + `req.file`.
 */
async function prepareSubtitleStartFromS3(req, res, next) {
  const rawKey =
    req.body && typeof req.body.s3Key === "string"
      ? req.body.s3Key.trim()
      : "";

  if (!rawKey) {
    return next();
  }

  if ((process.env.STORAGE_TYPE || "local") !== "s3") {
    return res.status(501).json({
      message: "Direct S3 upload is not enabled on this server.",
      code: "STORAGE_LOCAL",
    });
  }

  const prefix = `subtitles/${req.userId}/`;
  if (!rawKey.startsWith(prefix) || rawKey.includes("..")) {
    return res.status(403).json({ message: "Invalid storage key." });
  }

  const originalFileName =
    (req.body.originalFileName && String(req.body.originalFileName).trim()) ||
    "upload.bin";
  const mimeType =
    (req.body.mimeType && String(req.body.mimeType).trim()) ||
    "application/octet-stream";

  if (!AUDIO_VIDEO_MIMES.has(mimeType)) {
    return res.status(415).json({ message: `Unsupported mime type: ${mimeType}` });
  }

  let dest = null;
  try {
    const meta = await headS3ObjectMeta(rawKey);
    if (!meta.contentLength || meta.contentLength <= 0) {
      return res.status(400).json({
        message: "Uploaded object is empty or missing.",
      });
    }

    const ext = path.extname(originalFileName) || ".tmp";
    dest = path.join(os.tmpdir(), `sub_s3_${uuidv4()}${ext}`);
    await downloadS3ObjectToFile(rawKey, dest);

    req.subtitleTmpProbeFile = dest;
    req.subtitlePresignedS3Key = rawKey;
    req.file = {
      fieldname: "file",
      originalname: originalFileName,
      encoding: "7bit",
      mimetype: mimeType,
      size: meta.contentLength,
      buffer: null,
    };
    return next();
  } catch (err) {
    if (dest) {
      try {
        fs.unlinkSync(dest);
      } catch {
        /* ignore */
      }
    }
    const status = err.$metadata?.httpStatusCode;
    if (status === 404 || err.name === "NotFound") {
      return res.status(400).json({
        message:
          "File not found in storage. Finish the browser upload before starting the job.",
      });
    }
    return next(err);
  }
}

module.exports = {
  prepareSubtitleStartFromS3,
};
