/**
 * One-off migration: create Project documents 1:1 with existing subtitle/dubbing jobs.
 * Reads raw BSON so legacy fields (displayName, pinnedAt, archivedAt) on job docs are copied
 * even if removed from Mongoose schemas.
 *
 * Usage (from backend/):
 *   1. If you ever hit E11000 on dubbingJob_1 / subtitleJob_1: node scripts/fixProjectIndexes.js
 *   2. node scripts/backfillProjects.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Project = require("../models/Project");
const SubtitleJob = require("../models/Subtitle");
const DubbingJob = require("../models/DubbingJob");

async function upsertSubtitleProject(doc) {
  const displayName = doc.displayName ?? null;
  const pinnedAt = doc.pinnedAt ?? null;
  const archivedAt = doc.archivedAt ?? null;

  await Project.findOneAndUpdate(
    { subtitleJob: doc._id },
    {
      $set: {
        user: doc.user,
        kind: "subtitle",
        subtitleJob: doc._id,
        displayName,
        pinnedAt,
        archivedAt,
      },
      $unset: { dubbingJob: "" },
    },
    { upsert: true, new: true }
  );
}

async function upsertDubbingProject(doc) {
  const displayName = doc.displayName ?? null;
  const pinnedAt = doc.pinnedAt ?? null;
  const archivedAt = doc.archivedAt ?? null;

  await Project.findOneAndUpdate(
    { dubbingJob: doc._id },
    {
      $set: {
        user: doc.user,
        kind: "dubbing",
        dubbingJob: doc._id,
        displayName,
        pinnedAt,
        archivedAt,
      },
      $unset: { subtitleJob: "" },
    },
    { upsert: true, new: true }
  );
}

async function main() {
  const uri = process.env.MONGO_ID;
  if (!uri) {
    console.error("MONGO_ID is not set.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected.");

  const subColl = SubtitleJob.collection;
  const dubColl = DubbingJob.collection;

  let subCount = 0;
  const subCursor = subColl.find({});
  for await (const doc of subCursor) {
    await upsertSubtitleProject(doc);
    subCount += 1;
    if (subCount % 500 === 0) console.log(`Subtitle jobs processed: ${subCount}`);
  }
  console.log(`Done subtitle jobs: ${subCount}`);

  let dubCount = 0;
  const dubCursor = dubColl.find({});
  for await (const doc of dubCursor) {
    await upsertDubbingProject(doc);
    dubCount += 1;
    if (dubCount % 500 === 0) console.log(`Dubbing jobs processed: ${dubCount}`);
  }
  console.log(`Done dubbing jobs: ${dubCount}`);

  await mongoose.disconnect();
  console.log("Disconnected.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
