"use strict";

const mongoose = require("mongoose");

const DubbingJob = require("../models/DubbingJob");
const checkDubbingLimits = require("./checkDubbingLimits");

function limitError(message, statusCode = 429) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = async function checkDubbingRetargetLimits(req, res, next) {
  try {
    const idempotencyKey = (req.headers["x-idempotency-key"] || "").trim() || null;

    if (idempotencyKey) {
      const existingJob = await DubbingJob.findOne({
        user: req.userId,
        idempotencyKey,
      })
        .select("_id status")
        .lean();

      if (existingJob) {
        res.write(
          `data: ${JSON.stringify({
            stage: "duplicate",
            message: "Duplicate request detected. Returning existing job.",
            jobId: existingJob._id,
            status: existingJob.status,
          })}\n\n`,
        );
        return res.end();
      }
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw limitError("Dubbing job not found.", 404);
    }

    const sourceJob = await DubbingJob.findOne({
      _id: req.params.id,
      user: req.userId,
    }).lean();

    if (!sourceJob) {
      throw limitError("Dubbing job not found.", 404);
    }
    if (sourceJob.status !== "completed") {
      throw limitError("Only completed dubbing jobs can be dubbed in another language.", 422);
    }
    if (!Number.isFinite(sourceJob.duration) || sourceJob.duration <= 0) {
      throw limitError("Source job has no detectable duration.", 422);
    }
    if (
      !Array.isArray(sourceJob.segments) ||
      !sourceJob.segments.some((seg) => String(seg.originalText || "").trim())
    ) {
      throw limitError("Source job does not have reusable transcript segments.", 422);
    }

    const flags = await checkDubbingLimits.reserveDubbingUsage({
      userId: req.userId,
      durationSeconds: sourceJob.duration,
      enforceDurationLimit: false,
    });

    req.dubbingRetargetSourceJob = sourceJob;
    req.dubbingDurationSeconds = sourceJob.duration;
    req.dubbingPlanFlags = flags;
    req.dubbingUsageReserved = true;
    req.dubbingIdempotencyKey = idempotencyKey;

    next();
  } catch (err) {
    next(err);
  }
};
