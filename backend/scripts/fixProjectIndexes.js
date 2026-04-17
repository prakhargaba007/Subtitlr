/**
 * Drops legacy unique indexes on subtitleJob/dubbingJob that treated many `null` values as duplicates,
 * then syncs indexes from the Project model (partial unique indexes).
 *
 * Run from backend/: node scripts/fixProjectIndexes.js
 * Then: node scripts/backfillProjects.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Project = require("../models/Project");

async function dropIndexIfExists(collection, name) {
  try {
    await collection.dropIndex(name);
    console.log(`Dropped index: ${name}`);
  } catch (e) {
    if (e.code === 27 || e.codeName === "IndexNotFound") {
      console.log(`Skip missing index: ${name}`);
    } else {
      throw e;
    }
  }
}

async function main() {
  const uri = process.env.MONGO_ID;
  if (!uri) {
    console.error("MONGO_ID is not set.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected.");

  const coll = Project.collection;

  await coll.updateMany(
    { kind: "subtitle", dubbingJob: null },
    { $unset: { dubbingJob: "" } }
  );
  await coll.updateMany(
    { kind: "dubbing", subtitleJob: null },
    { $unset: { subtitleJob: "" } }
  );
  console.log("Cleaned explicit null sibling refs where present.");

  await dropIndexIfExists(coll, "dubbingJob_1");
  await dropIndexIfExists(coll, "subtitleJob_1");

  await Project.syncIndexes();
  console.log("Project.syncIndexes() done.");

  await mongoose.disconnect();
  console.log("Disconnected.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
