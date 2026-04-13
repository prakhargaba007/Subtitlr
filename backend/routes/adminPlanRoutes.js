const express = require("express");
const isAuth = require("../middleware/is-auth");
const isAdmin = require("../middleware/is-admin");
const adminPlanCatalogController = require("../controllers/adminPlanCatalogController");

const router = express.Router();

router.use(isAuth, isAdmin);

router.get("/", adminPlanCatalogController.listAllPlans);
router.post("/", adminPlanCatalogController.createPlan);
router.patch("/:id", adminPlanCatalogController.patchPlan);

module.exports = router;

