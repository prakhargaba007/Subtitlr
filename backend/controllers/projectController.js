const mongoose = require("mongoose");
const Project = require("../models/Project");
const SubtitleJob = require("../models/Subtitle");
const DubbingJob = require("../models/DubbingJob");
const { storage } = require("../utils/storage");
const {
  buildProjectSearchDocument,
  buildProjectSearchFilter,
  normalizeSearchText,
  scoreProjectSearchResult,
} = require("../utils/projectSearch");
const { buildProjectFilterFields } = require("../utils/projectFilterFields");

async function attachThumbToJob(job) {
  if (!job) return job;
  const o = job.toObject ? job.toObject() : { ...job };
  if (!o.thumbnailKey) return o;
  try {
    return { ...o, thumbnailUrl: await storage.getPublicUrl(o.thumbnailKey) };
  } catch (_) {
    return o;
  }
}

async function getProjectJob(project) {
  if (!project) return null;
  if (project.kind === "subtitle" && project.subtitleJob) {
    return SubtitleJob.findById(project.subtitleJob)
      .select("originalFileName fileType duration creditsUsed status language createdAt originalFileUrl thumbnailKey")
      .lean();
  }
  if (project.kind === "dubbing" && project.dubbingJob) {
    return DubbingJob.findById(project.dubbingJob)
      .select(
        "originalFileName fileType duration creditsUsed status sourceLanguage targetLanguage createdAt dubbedVideoUrl dubbedAudioUrl thumbnailKey",
      )
      .lean();
  }
  return null;
}

async function hydrateProjectRows(projectDocs) {
  const subtitleIds = projectDocs
    .filter((p) => p.kind === "subtitle" && p.subtitleJob)
    .map((p) => p.subtitleJob);
  const dubbingIds = projectDocs
    .filter((p) => p.kind === "dubbing" && p.dubbingJob)
    .map((p) => p.dubbingJob);

  const [subtitleJobs, dubbingJobs] = await Promise.all([
    subtitleIds.length
      ? SubtitleJob.find({ _id: { $in: subtitleIds } })
          .select("-segments")
          .lean()
      : [],
    dubbingIds.length
      ? DubbingJob.find({ _id: { $in: dubbingIds } })
          .select("-segments")
          .lean()
      : [],
  ]);

  const subMap = new Map(subtitleJobs.map((j) => [String(j._id), j]));
  const dubMap = new Map(dubbingJobs.map((j) => [String(j._id), j]));

  const pending = projectDocs
    .map((p) => {
      const job =
        p.kind === "subtitle"
          ? subMap.get(String(p.subtitleJob))
          : dubMap.get(String(p.dubbingJob));
      if (!job) return null;
      return { p, job };
    })
    .filter(Boolean);

  return Promise.all(
    pending.map(async ({ p, job }) => ({
      _id: p._id,
      kind: p.kind,
      displayName: p.displayName ?? null,
      pinnedAt: p.pinnedAt ?? null,
      archivedAt: p.archivedAt ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      job: await attachThumbToJob(job),
    })),
  );
}

function parseCreatedFilter(value) {
  const now = new Date();
  const created = String(value || "all").toLowerCase();
  if (created === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { $gte: start };
  }
  if (created === "7d") {
    return { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  }
  if (created === "30d") {
    return { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }
  return null;
}

function buildSort(sort) {
  switch (String(sort || "pinned").toLowerCase()) {
    case "newest":
      return { createdAt: -1 };
    case "oldest":
      return { createdAt: 1 };
    case "pinned":
    default:
      return { pinnedAt: -1, createdAt: -1 };
  }
}

/**
 * GET /api/projects?page=1&limit=10&archived=0|1&search=query&type=dubbing&created=7d&status=ready&sort=newest
 */
exports.getProjects = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;
    const search = normalizeSearchText(req.query.search || "");
    const showArchived =
      req.query.archived === "1" ||
      req.query.archived === "true" ||
      req.query.archived === "yes";

    const filter = showArchived
      ? { user: req.userId, archivedAt: { $ne: null } }
      : { user: req.userId, archivedAt: null };
    const type = String(req.query.type || "all").toLowerCase();
    const status = String(req.query.status || "all").toLowerCase();
    const createdFilter = parseCreatedFilter(req.query.created);
    const sort = buildSort(req.query.sort);

    if (type === "subtitle" || type === "dubbing") {
      filter.kind = type;
    }
    if (status === "ready" || status === "processing" || status === "failed") {
      filter.jobStatus = status;
    }
    if (createdFilter) {
      filter.createdAt = createdFilter;
    }

    if (search) {
      const { filter: searchFilter, normalized, queryTokens, queryTrigrams } =
        buildProjectSearchFilter(filter, search);
      const candidateLimit = Math.min(500, Math.max(skip + limit * 5, limit * 5));
      const candidates = await Project.find(searchFilter)
        .sort(sort)
        .limit(candidateLimit)
        .lean();

      const scored = candidates
        .map((project) => ({
          project,
          score: scoreProjectSearchResult(project, normalized, queryTokens, queryTrigrams),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const aPinned = a.project.pinnedAt ? new Date(a.project.pinnedAt).getTime() : 0;
          const bPinned = b.project.pinnedAt ? new Date(b.project.pinnedAt).getTime() : 0;
          if (bPinned !== aPinned) return bPinned - aPinned;
          if (sort.createdAt === 1) {
            return new Date(a.project.createdAt).getTime() - new Date(b.project.createdAt).getTime();
          }
          return new Date(b.project.createdAt).getTime() - new Date(a.project.createdAt).getTime();
        });

      const total = scored.length;
      const projectDocs = scored.slice(skip, skip + limit).map((item) => item.project);
      const items = await hydrateProjectRows(projectDocs);

      res.json({
        projects: items,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit) || 1),
      });
      return;
    }

    const [projectDocs, total] = await Promise.all([
      Project.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments(filter),
    ]);

    const items = await hydrateProjectRows(projectDocs);

    const pagesOut = Math.max(1, Math.ceil(total / limit) || 1);

    res.json({
      projects: items,
      total,
      page,
      pages: pagesOut,
    });
  } catch (err) {
    next(err);
  }
};

async function ensureProjectOwned(req, projectId) {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    const err = new Error("Project not found.");
    err.statusCode = 404;
    throw err;
  }
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error("Project not found.");
    err.statusCode = 404;
    throw err;
  }
  if (project.user.toString() !== req.userId) {
    const err = new Error("Access denied.");
    err.statusCode = 403;
    throw err;
  }
  return project;
}

exports.patchProject = async (req, res, next) => {
  try {
    const project = await ensureProjectOwned(req, req.params.id);
    const { displayName } = req.body || {};

    if (displayName === null) {
      project.displayName = null;
    } else if (typeof displayName === "string") {
      const trimmed = displayName.trim();
      project.displayName = trimmed.length ? trimmed : null;
    }

    const job = await getProjectJob(project);
    Object.assign(project, buildProjectSearchDocument(project, job), buildProjectFilterFields(job));
    await project.save();
    res.json({ project: project.toObject ? project.toObject() : project });
  } catch (err) {
    next(err);
  }
};

exports.pinProject = async (req, res, next) => {
  try {
    const project = await ensureProjectOwned(req, req.params.id);
    project.pinnedAt = new Date();
    await project.save();
    res.json({ project: project.toObject ? project.toObject() : project });
  } catch (err) {
    next(err);
  }
};

exports.unpinProject = async (req, res, next) => {
  try {
    const project = await ensureProjectOwned(req, req.params.id);
    project.pinnedAt = null;
    await project.save();
    res.json({ project: project.toObject ? project.toObject() : project });
  } catch (err) {
    next(err);
  }
};

exports.archiveProject = async (req, res, next) => {
  try {
    const project = await ensureProjectOwned(req, req.params.id);
    project.archivedAt = new Date();
    await project.save();
    res.json({ project: project.toObject ? project.toObject() : project });
  } catch (err) {
    next(err);
  }
};

exports.restoreProject = async (req, res, next) => {
  try {
    const project = await ensureProjectOwned(req, req.params.id);
    project.archivedAt = null;
    await project.save();
    res.json({ project: project.toObject ? project.toObject() : project });
  } catch (err) {
    next(err);
  }
};
