const express = require("express");
const router = express.Router();

const isAuth = require("../middleware/is-auth");
const {
  getProjects,
  patchProject,
  pinProject,
  unpinProject,
  archiveProject,
  restoreProject,
} = require("../controllers/projectController");

// GET /api/projects?page=1&limit=10&archived=1
router.get("/", isAuth, getProjects);

// PATCH /api/projects/:id
router.patch("/:id", isAuth, patchProject);

router.post("/:id/pin", isAuth, pinProject);
router.post("/:id/unpin", isAuth, unpinProject);
router.post("/:id/archive", isAuth, archiveProject);
router.post("/:id/restore", isAuth, restoreProject);

module.exports = router;
